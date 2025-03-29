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
import { useState } from 'react';
import { downloadModel } from '../api/model';
import ProgressBar from '../components/ProgressBar';
import { initLlama, releaseAllLlama, loadLlamaModelInfo } from 'llama.rn';
import RNFS from 'react-native-fs';

export default function HomeScreen() {
  type Message = {
    role: 'system' | 'user' | 'assistant';
    content: string;
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
    const downloadUrl = `https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q2_K.gguf?download=true`;
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
        Alert.alert('Error Loading Model', 'The model file does not exist.');
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
        n_gpu_layers:20 ,
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

    const newConversation: Message[] = [
      ...conversation,
      { role: 'user', content: userInput },
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
        <Text style={styles.title}>LLM Chatbot</Text>
  
        <TouchableOpacity onPress={() => handleDownloadModel('Llama-3.2-1B-Instruct-Q5_K_L.gguf')}>
          <Text style={styles.button}>Download Model</Text>
        </TouchableOpacity>
  
        {isDownloading && <ProgressBar progress={progress} />}
  
        <View style={styles.chatWrapper}>
          <ScrollView
            style={styles.chatBox}
            contentContainerStyle={{ paddingBottom: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {conversation.map((msg, index) => (
              <Text key={index} style={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                {msg.role}: {msg.content}
              </Text>
            ))}
          </ScrollView>
        </View>
  
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
  
});
