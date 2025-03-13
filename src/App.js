import React, { useState } from "react";
import axios from "axios";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// Variables de entorno (muévelas a un archivo .env en producción)
const speechKey = process.env.REACT_APP_SPEECH_KEY;
const speechRegion = process.env.REACT_APP_SPEECH_REGION;
const azureOpenAIEndpoint = process.env.REACT_APP_AZURE_OPENAI_ENDPOINT;
const azureOpenAIKey = process.env.REACT_APP_AZURE_OPENAI_KEY;
const deploymentName = process.env.REACT_APP_DEPLOYMENT_NAME; // El nombre del modelo (p. ej. gpt-4-turbo)

const VoiceBot = () => {
    const [responseText, setResponseText] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [logs, setLogs] = useState(["🟢 Starting VoiceBot..."]);
    const [conversationHistory, setConversationHistory] = useState([
        {
            role: "system",
            content:
                "You are a customer experiencing issues with Microsoft products. You are asking for support from a Microsoft support agent.",
        },
    ]);

    const logMessage = (msg) => {
        setLogs((prevLogs) => [...prevLogs, msg]);
        console.log(msg);
    };

    /** 🎙️ Reconocimiento de voz con Azure Speech Services */
    const recognizeSpeech = async () => {
        setIsListening(true);
        logMessage("🎤 Listening...");

        try {
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
            speechConfig.speechRecognitionLanguage = "en-US";

            const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            recognizer.recognizeOnceAsync(async (result) => {
                setIsListening(false);

                if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    logMessage(`✅ Recognized text: ${result.text}`);
                    await sendMessageToOpenAI(result.text);
                } else {
                    logMessage("⚠️ No speech recognized.");
                }
                recognizer.close();
            });
        } catch (error) {
            setIsListening(false);
            logMessage(`❌ Speech recognition error: ${error.message}`);
        }
    };

    /** 📤 Enviar mensaje a Azure OpenAI */
    const sendMessageToOpenAI = async (message) => {
        logMessage(`📤 Sending to Azure OpenAI: ${message}`);
        if (!message.trim()) {
            logMessage("⚠️ Empty message. Not sending.");
            return;
        }

        // Actualiza el historial de conversación
        const newHistory = [
            ...conversationHistory,
            { role: "user", content: message }, // El mensaje del cliente (bot)
        ];

        try {
            const response = await axios.post(
                `${azureOpenAIEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`,
                {
                    messages: newHistory,
                    max_tokens: 1000,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "api-key": azureOpenAIKey,
                    },
                }
            );

            const botReply = response.data.choices[0]?.message?.content || "No response received.";
            logMessage(`🤖 Bot response: ${botReply}`);

            // Actualiza el historial con la respuesta del agente
            setConversationHistory([
                ...newHistory,
                { role: "assistant", content: botReply }, // La respuesta del agente de soporte
            ]);
            setResponseText(botReply);
            speakResponse(botReply);
        } catch (error) {
            logMessage(`❌ Error communicating with Azure OpenAI: ${error.message}`);
        }
    };

    /** 🔊 Text-to-Speech con Azure Speech Services */
    const speakResponse = (text) => {
        if (!text.trim()) {
            logMessage("⚠️ No text to synthesize.");
            return;
        }

        logMessage(`🔊 Synthesizing speech: ${text}`);

        try {
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
            speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);

            synthesizer.speakTextAsync(
                text,
                () => {
                    logMessage("✅ Speech synthesis completed.");
                    synthesizer.close();
                },
                (error) => {
                    logMessage(`❌ Speech synthesis error: ${error.message}`);
                    synthesizer.close();
                }
            );
        } catch (error) {
            logMessage(`❌ Unexpected error in speech synthesis: ${error.message}`);
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "10px" }}>
            <h1>🎙️ VoiceBot with Azure OpenAI (GPT-4)</h1>
            <div style={{ margin: "20px 0" }}>
                <button 
                    onClick={recognizeSpeech} 
                    disabled={isListening} 
                    style={{ padding: "10px", fontSize: "16px", cursor: isListening ? "not-allowed" : "pointer" }}
                >
                    {isListening ? "🎤 Listening..." : "🎙️ Talk to AI"}
                </button>
            </div>

            <h3>📝 Bot's Response:</h3>
            <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333", padding: "10px", border: "1px solid #eee", borderRadius: "5px", background: "#f9f9f9" }}>
                {responseText || "No response yet..."}
            </p>

            <h3>📜 Logs:</h3>
            <div style={{ textAlign: "left", maxHeight: "200px", overflowY: "auto", padding: "10px", border: "1px solid #ddd", borderRadius: "5px", background: "#f9f9f9" }}>
                {logs.map((log, index) => (
                    <p key={index} style={{ margin: "5px 0", fontSize: "14px" }}>{log}</p>
                ))}
            </div>
        </div>
    );
};

export default VoiceBot;
