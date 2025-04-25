import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import downloadModel from '../api/model';
import ProgressBar from '../components/ProgressBar';
import { initLlama, releaseAllLlama, loadLlamaModelInfo } from 'llama.rn';
import RNFS from 'react-native-fs';
import * as Speech from 'expo-speech';
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent
} from '@react-native-voice/voice';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export default function HomeScreen() {

  const [results, setResults] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Set up voice event handlers
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;

    // Clean up on unmount
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechResults = (e: SpeechResultsEvent) => {
    console.log('Speech results:', e);
    if (e.value) {
      const transcript = e.value.join(' ');
      setResults(e.value);
      setUserInput(transcript);
    }
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    console.log('Speech error:', e);
    setError(JSON.stringify(e.error));
    setIsListening(false);
  };

  const startListening = async () => {
    try {
      setError('');
      setResults([]);

      // Request permissions
      if (Platform.OS === 'ios') {
        console.log('Requesting iOS permissions...');
        const micPermission = await request(PERMISSIONS.IOS.MICROPHONE);
        const speechPermission = await request(PERMISSIONS.IOS.SPEECH_RECOGNITION);

        console.log('Permission results:', { mic: micPermission, speech: speechPermission });

        if (micPermission !== RESULTS.GRANTED || speechPermission !== RESULTS.GRANTED) {
          setError('Permissions not granted');
          return;
        }
      }

      console.log('Starting Voice.start()...');
      await Voice.start('en-US');
      console.log('Voice.start() successful');
      setIsListening(true);
    } catch (e) {
      console.error('Error starting voice recognition:', e);
      setError(`Start error: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);

    } catch (e) {
      console.error('Error stopping voice recognition:', e);
    }
  };

  const speak = (text: string) => {
    if (!text || text.trim() === '') return;

    // Remove emojis and <end_of_turn>-like tags
    let cleanedText = text.replace(/<[^>]*>/g, '');

    // Remove emojis using a basic range-based approach (works for most emojis)
    cleanedText = cleanedText.replace(
      /([\u231A-\uD83E\uDDFF]|\uD83C[\uDDE6-\uDDFF])+/g,
      ''
    );



    console.log('Speaking:', cleanedText);
    Speech.speak(cleanedText, {
      language: 'en',
      rate: 0.9,
      onDone: () => console.log('Speech done'),
      onError: (e) => console.error('Speech error', e),
    });
  };
  type Message = {
    role: 'system' | 'user' | 'assistant';
    content:
    | string
    | Array<
      | { type: 'text'; text: string }
      | { type: 'image'; url: string }
      | { type: 'image'; image_tokens: number[] }
    >;
  };


  const INITIAL_CONVERSATION: Message[] = [
    {
      role: 'system',
      content: 'This is a conversation between user and assistant, a friendly chatbot.',
    },
  ];

  const [conversation, setConversation] = useState<Message[]>(INITIAL_CONVERSATION);
  const [userInput, setUserInput] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [context, setContext] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleDownloadModel = async (file: string) => {
    const downloadUrl = `https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q3_K_M.gguf`;
    setIsDownloading(true);
    setProgress(0);

    try {
      const destPath = await downloadModel(file, downloadUrl, progress => setProgress(progress));
      if (destPath) {
        await loadModel(file);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed due to an unknown error.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const loadModel = async (modelName: string) => {
    try {
      const destPath = `${RNFS.DocumentDirectoryPath}/${modelName}`;
      const fileExists = await RNFS.exists(destPath);
      if (!fileExists) {
        Alert.alert('Missing File', `Model file "${modelName}" not found in local storage.`);
        console.log('File does not exist!');

        return false;

      }

      if (context) {
        await releaseAllLlama();
        setContext(null);
        setConversation(INITIAL_CONVERSATION);
      }

      console.log('Model Info:', await loadLlamaModelInfo(destPath));

      const llamaContext = await initLlama({
        model: destPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 5,
      });

      setContext(llamaContext);

      return true;
    } catch (error) {
      Alert.alert(
        'Error Loading Model',
        error instanceof Error ? error.message : 'An unknown error occurred.'
      );
      return false;
    }
  };

  const handleSendMessage = async () => {
    if (!context) {
      Alert.alert('Model Not Loaded', 'Please load the model first.');
      return;
    }

    if (!userInput.trim()) {
      Alert.alert('Input Error', 'Please enter a message.');
      return;
    }



    // const newConversation: Message[] = [
    //   ...conversation,
    //   { role: 'user', content: userInput },

    // ];
    const newConversation: Message[] = [
      ...conversation,
      {
        role: "user",
        content: userInput
      },
    ];
    setIsGenerating(true);
    setConversation(newConversation);
    setUserInput('');

    try {
      const stopWords = [
        '</s>',
        '<|end|>',
        'user:',
        'assistant:',
        '<|im_end|>',
        '<|eot_id|>',
        '<|end▁of▁sentence|>',
        '<｜end▁of▁sentence｜>',
      ];

      const result = await context.completion({
        messages: newConversation,
        n_predict: 1000,
        stop: stopWords,
      });

      if (result && result.text) {
        setConversation(prev => [
          ...prev,
          { role: 'assistant', content: result.text.trim() },
        ]);
        Speech.speak(result.text);
      } else {
        throw new Error('No response from the model.');
      }
    } catch (error) {
      Alert.alert(
        'Error During Inference',
        error instanceof Error ? error.message : 'An unknown error occurred.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >

        <TouchableOpacity onPress={() => handleDownloadModel('gemma-3-1b-it-Q2_K_L.gguf')}>
          <Text style={styles.button}>Download Model</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => loadModel('gemma-3-1b-it-Q2_K_L.gguf')}>
          <Text style={styles.button}>Load Model</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => speak("Hi Harvey Mudd!")}>
          <Text style={styles.button}>Analyze Image</Text>
        </TouchableOpacity>

        {isDownloading && <ProgressBar progress={progress} />}

        <View style={styles.chatWrapper}>
          <ScrollView
            style={styles.chatBox}
            contentContainerStyle={{ paddingBottom: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {conversation.map((msg, index) => (
              <View key={index} style={{ marginBottom: 10 }}>
                <Text style={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                  {msg.role}:
                </Text>
                {typeof msg.content === 'string' ? (
                  <Text style={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                    {msg.content}
                  </Text>
                ) : (
                  msg.content.map((item, subIndex) => {
                    if (item.type === 'text') {
                      return (
                        <Text
                          key={subIndex}
                          style={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}
                        >
                          {item.text}
                        </Text>
                      );
                    } else if ('url' in item) {
                      return (
                        <Text key={subIndex} style={{ fontStyle: 'italic', color: '#888' }}>
                          [Image: {item.url}]
                        </Text>
                      );
                    }
                    return null;
                  })
                )}
              </View>
            ))}

          </ScrollView>
        </View>

        <TouchableOpacity
          onPress={isListening ? stopListening : startListening}
          style={[
            styles.micButton,
            isListening ? styles.micActive : null
          ]}
          accessibilityLabel={isListening ? "Stop Recording" : "Start Recording"}
        >
          <Text style={styles.micText}>
            {isListening ? '🛑 Stop Talking' : '🎙️ Talk to Chatbot'}
          </Text>
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            value={userInput}
            onChangeText={setUserInput}
            editable={!isGenerating}
          />
          <TouchableOpacity onPress={handleSendMessage} disabled={isGenerating}>
            <Text style={styles.sendButton}>{isGenerating ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );


}

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatWrapper: {
    flexGrow: 1,
    maxHeight: '60%', // You can adjust this to allow more or less chat space
    marginBottom: 12,
  },
  chatBox: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    padding: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  sendButton: {
    fontSize: 16,
    color: '#007aff',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
  },
  button: {
    fontSize: 18,
    color: 'blue',
    marginBottom: 12,
    textAlign: 'center',
  },
  userMsg: {
    textAlign: 'right',
    marginBottom: 10,
    color: '#333',
  },
  assistantMsg: {
    textAlign: 'left',
    marginBottom: 10,
    color: '#007aff',
  },
  micButton: {
    backgroundColor: '#007aff',
    padding: 20,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micActive: {
    backgroundColor: '#ff3b30',
  },
  micText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },

});
