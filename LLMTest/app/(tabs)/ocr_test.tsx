// import { useState } from 'react';
// import { View, Text, StyleSheet, Image, Button } from 'react-native';
// import * as ImagePicker from 'expo-image-picker';
// import TextRecognition from '@react-native-ml-kit/text-recognition';
// import * as Speech from 'expo-speech';

// const MyPage = () => {
//     const [image, setImage] = useState<string | null>(null);
//     const [imageText, setImageText] = useState<string | null>(null);


//     const pickImage = async () => {
//         const result = await ImagePicker.launchImageLibraryAsync({
//             mediaTypes: ImagePicker.MediaTypeOptions.Images,
//             allowsEditing: true,
//             aspect: [4, 3],
//             quality: 1,
//         });

//         if (!result.canceled) {
//             setImage(result.assets[0].uri);
//         }
//     };

//     const runModel = async () => {
//         if (image) {
//             const result = await TextRecognition.recognize(image);
//             console.log('Recognized text:', result.text);
//             setImageText(result.text);

//             if (result.text) {
//                 Speech.speak(result.text, {
//                     language: 'en',
//                     rate: 0.9,
//                     onDone: () => console.log('Speech done'),
//                     onError: (e) => console.error('Speech error', e),
//                 });
//             }
//         }
//     };

//     return (
//         <View style={styles.container}>
//             <Button title="Pick an image from camera roll" onPress={pickImage} />
//             {image && <Image source={{ uri: image }} style={styles.image} />}
//             <Button title="Run OCR" onPress={runModel} />
//         </View>
//     );
// };

// export default MyPage;

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         backgroundColor: '#fff',
//         padding: 16,
//     },
//     image: {
//         width: 200,
//         height: 200,
//         marginVertical: 10,
//     },
// });


import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Button,
    ScrollView,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Speech from 'expo-speech';
import RNFS from 'react-native-fs';
import { initLlama, releaseAllLlama, loadLlamaModelInfo } from 'llama.rn';

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

const INITIAL_PROMPT = 'Summarize this text in 100 words\n\n';

const MyPage = () => {
    const [image, setImage] = useState<string | null>(null);
    const [conversation, setConversation] = useState<Message[]>([]);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [context, setContext] = useState<any>(null);

    const [userInput, setUserInput] = useState<string>('');

    const handleSendMessage = async () => {
        if (!context) {
            Alert.alert('Model Not Loaded', 'Please load the model first.');
            return;
        }

        if (!userInput.trim()) return;

        const newMessages: Message[] = [
            ...conversation,
            { role: 'user', content: userInput.trim() },
        ];

        setConversation(newMessages);
        setUserInput('');
        setIsGenerating(true);

        try {
            const result = await context.completion({
                messages: newMessages,
                n_predict: 1000,
                stop: ['</s>', 'user:', 'assistant:'],
            });

            if (result && result.text) {
                const responseText = result.text.trim();
                setConversation((prev) => [
                    ...prev,
                    { role: 'assistant', content: responseText },
                ]);
                Speech.speak(responseText, { language: 'en', rate: 0.9 });
            }
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsGenerating(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const loadModel = async (modelName: string) => {
        try {
            const path = `${RNFS.DocumentDirectoryPath}/${modelName}`;
            const exists = await RNFS.exists(path);
            if (!exists) {
                Alert.alert('Model not found', `Missing model file: ${modelName}`);
                return;
            }

            if (context) {
                await releaseAllLlama();
                setContext(null);
            }

            const modelInfo = await loadLlamaModelInfo(path);
            console.log('Loaded Model Info:', modelInfo);

            const llamaContext = await initLlama({
                model: path,
                use_mlock: true,
                n_ctx: 2048,
                n_gpu_layers: 5,
            });

            setContext(llamaContext);
        } catch (err) {
            Alert.alert('Model Load Error', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const runModel = async () => {
        if (!image) return;
        if (!context) {
            Alert.alert('Model not loaded', 'Please load the LLM first.');
            return;
        }

        try {
            const result = await TextRecognition.recognize(image);
            const extractedText = result.text;

            if (!extractedText || extractedText.trim() === '') {
                Alert.alert('No Text Found', 'Could not extract any text from the image.');
                return;
            }

            const prompt = INITIAL_PROMPT + extractedText;
            const newMessages: Message[] = [
                ...conversation,
                { role: 'user', content: prompt },
            ];

            setConversation(newMessages);
            setIsGenerating(true);

            const response = await context.completion({
                messages: newMessages,
                n_predict: 1000,
                stop: ['</s>', 'user:', 'assistant:'],
            });

            if (response && response.text) {
                const responseText = response.text.trim();
                setConversation((prev) => [
                    ...prev,
                    { role: 'assistant', content: responseText },
                ]);

                Speech.speak(responseText, {
                    language: 'en',
                    rate: 0.9,
                });
            }
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                    <Button title="Load Model" onPress={() => loadModel('gemma-3-1b-it-Q2_K_L.gguf')} />
                </View>
                <View style={styles.buttonWrapper}>
                    <Button title="Pick an Image" onPress={pickImage} />
                </View>
            </View>

            {image && <Image source={{ uri: image }} style={styles.image} />}
            <Button title="Run OCR & Analyze" onPress={runModel} disabled={isGenerating || !image} />

            {isGenerating && <ActivityIndicator size="large" color="#007aff" style={{ marginTop: 16 }} />}

            <ScrollView style={styles.chatBox}>
                {conversation.map((msg, index) => (
                    <View key={index} style={styles.messageBubble}>
                        <Text style={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                            {msg.role.toUpperCase()} {msg.content}
                        </Text>
                    </View>
                ))}
            </ScrollView>

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
        </View>
    );
};

export default MyPage;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#fff',
    },
    image: {
        width: 250,
        height: 100,
        marginVertical: 10,
        alignSelf: 'center',
    },
    chatBox: {
        marginTop: 20,
        paddingHorizontal: 12,
    },
    messageBubble: {
        marginBottom: 12,
    },
    userMsg: {
        textAlign: 'right',
        color: '#333',
    },
    assistantMsg: {
        textAlign: 'left',
        color: '#007aff',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 10,
    },
    buttonWrapper: {
        flex: 1,
        marginHorizontal: 5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
      },
      input: {
        flex: 1,
        borderColor: '#ccc',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginRight: 8,
      },
      sendButton: {
        fontSize: 16,
        color: '#007aff',
        paddingHorizontal: 12,
      },
      
});
