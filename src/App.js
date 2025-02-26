import React, { useState, useEffect } from "react";
import axios from "axios";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

const speechKey = "758a23a13b3f4233b91ab0b69af6af01"; // 🔹 Reemplaza con tu API Key de Azure Speech
const speechRegion = "westus"; // 🔹 Reemplaza con la región de Azure Speech
const directLineToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsIng1dCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsInR5cCI6IkpXVCJ9.eyJib3QiOiJlOTc2ZDZiMC1lMmNkLTFiM2QtNzBlZi0zZTEwZjlmZTVmMDciLCJzaXRlIjoiOFNIaERJaTRyNHlEckwxTlRuYnZHMTVtZjJ6NE1DOHpscTd0Wlp1SHhxek1QN3A4QjhnVEpRUUo5OUJCQUM0ZjFjTUFBcm9oQUFBQkFaQlM0UGRKIiwiY29udiI6IjUxczhJc3dkNG5WUXdJcEFvaEdnaS1iciIsInVzZXIiOiI0MmFjOWZjNi0wMDc5LTQwNTMtYTRiZC02NWQzODQ2OGE0NjEiLCJuYmYiOjE3NDA1ODI4MzEsImV4cCI6MTc0MDU4NjQzMSwiaXNzIjoiaHR0cHM6Ly9kaXJlY3RsaW5lLmJvdGZyYW1ld29yay5jb20vIiwiYXVkIjoiaHR0cHM6Ly9kaXJlY3RsaW5lLmJvdGZyYW1ld29yay5jb20vIn0.lokHCnG47PnMMw5Qzi-NJQTpmmiYSM9-HRM5c-KZzdwA_-pkUBar52H2zJLpbweslODaIjHDGzGS526wLEKMK7zIK-JXWtjYrgUTBghzgEIma9p5RuE3XaBTDzPcuurEkyfNN5c2fybmaHSQkdDLILeqbGjriRwtUw2p48pvHnlqgn5FxJcNOVj7_y6kh1NdvpyNJpyOAvGCN5ER3tQiUfTUYSPlseJ1n-z5fbmNZStVWfkuOPDwb1fxv0Y2TXFtGHQhZo5TOw5KFJ56xhQ_6A8QmdIbU5MeXlOAAnOqTcVxE01fce075TuHDxr67fXqatjp9D_P7xJt7GM5cL9W3w";

const VoiceBot = () => {
    const [responseText, setResponseText] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [logs, setLogs] = useState(["🟢 Iniciando VoiceBot..."]);
    const [conversationId, setConversationId] = useState(null);
    const [lastUserMessageId, setLastUserMessageId] = useState(null);
    const [lastBotTimestamp, setLastBotTimestamp] = useState(""); // 🔹 Guarda la última respuesta del bot

    const logMessage = (msg) => {
        setLogs((prevLogs) => [...prevLogs, msg]);
        console.log(msg);
    };

    const startConversation = async () => {
        let existingConversationId = localStorage.getItem("conversationId");
        if (existingConversationId) {
            setConversationId(existingConversationId);
            logMessage(`:flechas_en_sentido_antihorario: Usando conversación existente con ID: ${existingConversationId}`);
            return existingConversationId;
        }
        try {
            logMessage(":flechas_en_sentido_antihorario: Iniciando nueva conversación con Copilot...");
            const response = await axios.post(
                "https://directline.botframework.com/v3/directline/conversations",
                {},
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );
            const newConversationId = response.data.conversationId;
            setConversationId(newConversationId);
            localStorage.setItem("conversationId", newConversationId); // Guardar en almacenamiento local
            logMessage(`:marca_de_verificación_blanca: Conversación iniciada con ID: ${newConversationId}`);
            return newConversationId;
        } catch (error) {
            logMessage(`:x: Error iniciando conversación: ${error.message}`);
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

    /** 📤 Enviar mensaje a Copilot */
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
            const response = await axios.post(
                `https://directline.botframework.com/v3/directline/conversations/${convId}/activities`,
                { type: "message", from: { id: "user1" }, text: message },
                { headers: { Authorization: `Bearer ${directLineToken}`, "Content-Type": "application/json" } }
            );

            if (response.data.id) {
                setLastUserMessageId(response.data.id);
                logMessage(`📩 Mensaje enviado con éxito (ID: ${response.data.id}). Esperando respuesta...`);
                await waitForBotResponse(convId);
            }
        } catch (error) {
            logMessage(`❌ Error al enviar mensaje a Copilot: ${error.message}`);
        }
    };

    /** ⏳ Espera hasta recibir la respuesta correcta */
    const waitForBotResponse = async (convId) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < 10000) { // 10 segundos de espera máxima
            const responseReceived = await getBotResponse(convId);
            if (responseReceived) return;
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Espera 1s antes de volver a consultar
        }

        logMessage("⚠️ No se recibió respuesta del bot en 10 segundos.");
    };

    /** 📥 Obtener respuesta del bot */
    const getBotResponse = async (convId) => {
        try {
            const response = await axios.get(
                `https://directline.botframework.com/v3/directline/conversations/${convId}/activities`,
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );

            const activities = response.data.activities;
            const botMessages = activities.filter(
                (act) => act.from.role === "bot" && act.replyToId === lastUserMessageId
            );

            if (botMessages.length > 0) {
                const latestBotMessage = botMessages[botMessages.length - 1];

                // 🔹 Evita respuestas repetidas
                if (latestBotMessage.timestamp !== lastBotTimestamp) {
                    setLastBotTimestamp(latestBotMessage.timestamp); // 🔄 Actualiza el timestamp
                    logMessage(`🤖 Respuesta del bot: ${latestBotMessage.text}`);
                    setResponseText(latestBotMessage.text);
                    speakResponse(latestBotMessage.text);
                    return true;
                }
            }

            return false;
        } catch (error) {
            logMessage(`❌ Error obteniendo respuesta de Copilot: ${error.message}`);
            return false;
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
