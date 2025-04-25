import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Image } from 'react-native';
import {
    useOCR,
    DETECTOR_CRAFT_1280
} from 'react-native-executorch';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface Point {
    x: number;
    y: number;
}

interface OCRDetection {
    bbox: Point[];
    text: string;
    score: number;
}

const SamplePage = () => {
    const [image, setImage] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [isModelReady, setIsModelReady] = useState<boolean>(false);
    const [modelError, setModelError] = useState<string | null>(null);

    const model = useOCR({
        detectorSource: 'xnnpack_craft_1280.pte',
        recognizerSources: {
            recognizerLarge: 'xnnpack_crnn_en_512.pte',
            recognizerMedium: 'xnnpack_crnn_en_256.pte',
            recognizerSmall: 'xnnpack_crnn_en_128.pte',
        },
        language: 'en',
    });


    useEffect(() => {
        // One-time check for model initialization
        const checkModelStatus = async () => {
            // Initial check
            setProgress(model.downloadProgress);
            setIsModelReady(model.isReady);
            setModelError(model.error);

            // If not ready and no error, wait for it to finish loading
            if (!model.isReady && !model.error) {
                // You could implement a promise-based approach here if the 
                // library provides one to signal when loading is complete
                console.log("Model is still loading...");
            }
        };

        checkModelStatus();
    }, [model]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);

            // try {
            //     const processedResult = await ImageManipulator.manipulateAsync(
            //         result.assets[0].uri,
            //         [{ resize: { width: 500 } }]
            //     );

            //     setProcessedImage(processedResult.uri);
            //     console.log("Image processed to 512px width");
            // } catch (error) {
            //     console.error("Error processing image:", error);
            // }
        }
    };

    const runModel = async () => {
        if (!isModelReady) {
            console.log("Model is not ready yet.");
            return;
        }

        if (!image) {
            console.log("No image selected for OCR");
            return;
        }

        try {

            const ocrDetections = await model.forward(image);
            console.log(ocrDetections);
            for (const ocrDetection of ocrDetections) {
                console.log('Bounding box: ', ocrDetection.bbox);
                console.log('Bounding text: ', ocrDetection.text);
                console.log('Bounding score: ', ocrDetection.score);
            }


        } catch (e) {
            console.error("Error running model.forward:", e);
        }
    };

    return (
        <View style={styles.container}>
            <Button title="Pick an image from camera roll" onPress={pickImage} />
            {image && <Image source={{ uri: image }} style={styles.image} />}
            <Text style={{ marginVertical: 10 }}>
                {modelError
                    ? `❌ Error loading model: ${modelError}`
                    : isModelReady
                        ? `✅ Model ready`
                        : `⏳ Loading model: ${Math.round(progress * 100)}%`}
            </Text>
            <Button title="Run OCR" onPress={runModel} disabled={!isModelReady} />
        </View>
    );
};

export default SamplePage;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    image: {
        width: 200,
        height: 200,
        marginVertical: 10,
    },
});
