import React, { useState, useEffect } from "react";
import axios from "axios";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

const speechKey = "758a23a13b3f4233b91ab0b69af6af01"; // 🔹 Reemplaza con tu API Key de Azure Speech
const speechRegion = "westus"; // 🔹 Reemplaza con la región de Azure Speech
const directLineToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsIng1dCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsInR5cCI6IkpXVCJ9.eyJib3QiOiJlOTc2ZDZiMC1lMmNkLTFiM2QtNzBlZi0zZTEwZjlmZTVmMDciLCJzaXRlIjoiOFNIaERJaTRyNHlEckwxTlRuYnZHMTVtZjJ6NE1DOHpscTd0Wlp1SHhxek1QN3A4QjhnVEpRUUo5OUJCQUM0ZjFjTUFBcm9oQUFBQkFaQlM0UGRKIiwiY29udiI6Ikk5N3hCYk5meVFIRGlkY0xya2NtRHctYnIiLCJ1c2VyIjoiMmM3NDllZTgtODY2ZC00YmUzLWEwNWItNGVlZmNhYjI2NDdkIiwibmJmIjoxNzQwNTc3MTc2LCJleHAiOjE3NDA1ODA3NzYsImlzcyI6Imh0dHBzOi8vZGlyZWN0bGluZS5ib3RmcmFtZXdvcmsuY29tLyIsImF1ZCI6Imh0dHBzOi8vZGlyZWN0bGluZS5ib3RmcmFtZXdvcmsuY29tLyJ9.FD9U-1lJo2uOMQeg8VE4e3sr8bas67CiznuEIJbqPH62XH4QAKJnfh4QwPUeGwL-ghBYzqiNbOvqdBjjkDxZ7FA5VbowQWWFx4kfQYPTkxJHOxvsQlfPLvaUO78HDoozD9strsLQ7IaTrgvTmp8QU02Ss_IJCjwnKoJQcTUianOKWtg_5W-hsXgq75khhETm5ii34VpAhh7NBgGNm6MYZQb2l4VBIIfwclWsj8KWTF8mBzdlZofUjU40Y-pKVUbJ97-lmtU84ZlefvpOyEQe0XaXP8TNCZMmJ_aSvP2qlIwhzedDhBGj5D02PUKPkYL-10ZYpJd3ciU2Ug-2E-ZLyA";


const VoiceBot = () => {
    const [responseText, setResponseText] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [logs, setLogs] = useState(["🟢 Iniciando VoiceBot..."]);
    const [conversationId, setConversationId] = useState(null);
    const [watermark, setWatermark] = useState(null); // Para evitar recibir respuestas duplicadas

    const logMessage = (msg) => {
        setLogs((prevLogs) => [...prevLogs, msg]);
        console.log(msg);
    };

    /** 🔄 Iniciar una conversación con Copilot Studio */
    const startConversation = async () => {
        if (conversationId) return conversationId; // Reutilizar conversación si ya existe

        try {
            logMessage("🔄 Iniciando nueva conversación con Copilot...");
            const response = await axios.post(
                "https://directline.botframework.com/v3/directline/conversations",
                {},
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );

            setConversationId(response.data.conversationId);
            logMessage(`✅ Conversación iniciada con ID: ${response.data.conversationId}`);
            return response.data.conversationId;
        } catch (error) {
            logMessage(`❌ Error iniciando conversación: ${error.message}`);
            return null;
        }
    };

    /** 🎙️ Reconocimiento de voz con Azure Speech Services */
    const recognizeSpeech = async () => {
        setIsListening(true);
        logMessage("🎤 Escuchando...");

        try {
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
            speechConfig.speechRecognitionLanguage = "en-US";

            const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            recognizer.recognizeOnceAsync(async (result) => {
                setIsListening(false);

                if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    logMessage(`✅ Texto reconocido: ${result.text}`);
                    await sendMessageToCopilot(result.text);
                } else {
                    logMessage("⚠️ No se reconoció ningún discurso.");
                }
                recognizer.close();
            });
        } catch (error) {
            setIsListening(false);
            logMessage(`❌ Error en reconocimiento de voz: ${error.message}`);
        }
    };

    /** 📤 Enviar mensaje a Copilot Studio */
    /** 📤 Enviar mensaje a Copilot Studio */
    const sendMessageToCopilot = async (message) => {
        logMessage(`📤 Enviando a Copilot: ${message}`);
        if (!message.trim()) {
            logMessage("⚠️ Mensaje vacío. No se enviará.");
            return;
        }

        const convId = await startConversation();
        if (!convId) {
            logMessage("❌ No se pudo obtener una conversación válida con Copilot.");
            return;
        }

        try {
            // Enviar el mensaje a Copilot
            await axios.post(
                `https://directline.botframework.com/v3/directline/conversations/${convId}/activities`,
                {
                    type: "message",
                    from: { id: "user1" },
                    text: message
                },
                {
                    headers: {
                        Authorization: `Bearer ${directLineToken}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            logMessage("📩 Mensaje enviado con éxito. Esperando respuesta...");

            // Espera 1 segundo antes de buscar la respuesta del bot
            setTimeout(() => {
                getBotResponse(convId);
            }, 1000); // Ajusta el tiempo si es necesario
        } catch (error) {
            logMessage(`❌ Error al enviar mensaje a Copilot: ${error.message}`);
        }
    };

    /** ⏳ Obtener respuesta de Copilot Studio */
    /** ⏳ Obtener respuesta de Copilot Studio */
    /** ⏳ Obtener respuesta de Copilot Studio */
    const getBotResponse = async (convId) => {
        try {
            // Esperamos un poco para dar tiempo a que el bot procese la respuesta
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos de espera
    
            const response = await axios.get(
                `https://directline.botframework.com/v3/directline/conversations/${convId}/activities`,
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );
    
            const activities = response.data.activities;
            if (activities.length > 0) {
                const latestActivity = activities[activities.length - 1];
                const gptFeedback = latestActivity.channelData?.["pva:gpt-feedback"];
    
                // Verificar que el estado de la respuesta sea "Answered"
                if (gptFeedback && gptFeedback.gptAnswerState === "Answered") {
                    // Obtener el textSummary desde la respuesta
                    const botReply = gptFeedback.summarizationOpenAIResponse?.result?.textSummary;
                    if (botReply) {
                        console.log(`🤖 Respuesta de Copilot: ${botReply}`);
                        setResponseText(botReply); // Mostrar respuesta en la UI
                        speakResponse(botReply); // Reproducir la respuesta en voz
                    } else {
                        console.log("⚠️ No se encontró textSummary en la respuesta.");
                    }
                } else {
                    console.log("⚠️ La respuesta aún no ha sido procesada o no ha llegado.");
                }
            } else {
                console.log("⚠️ No se recibió ninguna actividad.");
            }
        } catch (error) {
            console.error(`❌ Error obteniendo respuesta de Copilot: ${error.message}`);
        }
    };
    
    




    /** 🔊 Síntesis de voz con Azure Speech Services */
    const speakResponse = (text) => {
        if (!text.trim()) {
            logMessage("⚠️ No hay texto para sintetizar.");
            return;
        }

        logMessage(`🔊 Sintetizando voz: ${text}`);

        try {
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
            speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);

            synthesizer.speakTextAsync(
                text,
                () => {
                    logMessage("✅ Síntesis de voz completada.");
                    synthesizer.close();
                },
                (error) => {
                    logMessage(`❌ Error en síntesis de voz: ${error.message}`);
                    synthesizer.close();
                }
            );
        } catch (error) {
            logMessage(`❌ Error inesperado en síntesis de voz: ${error.message}`);
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "10px" }}>
            <h1>🎙️ VoiceBot con Azure Speech & Copilot Studio</h1>
            <button 
                onClick={recognizeSpeech} 
                disabled={isListening} 
                style={{ padding: "10px", fontSize: "16px", cursor: "pointer" }}
            >
                {isListening ? "🎤 Escuchando..." : "🎙️ Hablar con Copilot"}
            </button>

            <h3>📝 Respuesta del bot:</h3>
            <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>
                {responseText || "Aún no hay respuesta..."}
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
