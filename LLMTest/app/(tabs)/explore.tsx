import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent
} from '@react-native-voice/voice';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export default function SimpleVoiceTest() {
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
      setResults(e.value);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Voice Test</Text>
      
      <Button 
        title={isListening ? "Stop Listening" : "Start Listening"} 
        onPress={isListening ? stopListening : startListening} 
      />
      
      {error ? (
        <Text style={styles.errorText}>Error: {error}</Text>
      ) : null}
      
      <Text style={styles.resultsTitle}>Results:</Text>
      {results.map((result, index) => (
        <Text key={index} style={styles.resultText}>{result}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  resultText: {
    fontSize: 16,
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
  },
});