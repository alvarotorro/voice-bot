import React, { useState, useEffect } from "react";
import axios from "axios";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

const speechKey = "758a23a13b3f4233b91ab0b69af6af01"; // 🔹 Replace with your Azure Speech API Key
const speechRegion = "westus"; // 🔹 Replace with your Azure Speech region
const directLineToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsIng1dCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsInR5cCI6IkpXVCJ9.eyJib3QiOiJlOTc2ZDZiMC1lMmNkLTFiM2QtNzBlZi0zZTEwZjlmZTVmMDciLCJzaXRlIjoiOFNIaERJaTRyNHlEckwxTlRuYnZHMTVtZjJ6NE1DOHpscTd0Wlp1SHhxek1QN3A4QjhnVEpRUUo5OUJCQUM0ZjFjTUFBcm9oQUFBQkFaQlM0UGRKIiwiY29udiI6IjUxczhJc3dkNG5WUXdJcEFvaEdnaS1iciIsInVzZXIiOiI0MmFjOWZjNi0wMDc5LTQwNTMtYTRiZC02NWQzODQ2OGE0NjEiLCJuYmYiOjE3NDA1ODI4MzEsImV4cCI6MTc0MDU4NjQzMSwiaXNzIjoiaHR0cHM6Ly9kaXJlY3RsaW5lLmJvdGZyYW1ld29yay5jb20vIiwiYXVkIjoiaHR0cHM6Ly9kaXJlY3RsaW5lLmJvdGZyYW1ld29yay5jb20vIn0.lokHCnG47PnMMw5Qzi-NJQTpmmiYSM9-HRM5c-KZzdwA_-pkUBar52H2zJLpbweslODaIjHDGzGS526wLEKMK7zIK-JXWtjYrgUTBghzgEIma9p5RuE3XaBTDzPcuurEkyfNN5c2fybmaHSQkdDLILeqbGjriRwtUw2p48pvHnlqgn5FxJcNOVj7_y6kh1NdvpyNJpyOAvGCN5ER3tQiUfTUYSPlseJ1n-z5fbmNZStVWfkuOPDwb1fxv0Y2TXFtGHQhZo5TOw5KFJ56xhQ_6A8QmdIbU5MeXlOAAnOqTcVxE01fce075TuHDxr67fXqatjp9D_P7xJt7GM5cL9W3w";

const VoiceBot = () => {
    const [responseText, setResponseText] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [logs, setLogs] = useState(["🟢 Starting VoiceBot..."]);
    const [conversationId, setConversationId] = useState(null);
    const [lastUserMessageId, setLastUserMessageId] = useState(null);
    const [lastBotTimestamp, setLastBotTimestamp] = useState(""); // 🔹 Store the last bot response timestamp

    const logMessage = (msg) => {
        setLogs((prevLogs) => [...prevLogs, msg]);
        console.log(msg);
    };

    const startConversation = async () => {
        let existingConversationId = localStorage.getItem("conversationId");
        if (existingConversationId) {
            setConversationId(existingConversationId);
            logMessage(`:counterclockwise_arrows: Using existing conversation with ID: ${existingConversationId}`);
            return existingConversationId;
        }
        try {
            logMessage(":counterclockwise_arrows: Starting new conversation with Copilot...");
            const response = await axios.post(
                "https://directline.botframework.com/v3/directline/conversations",
                {},
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );
            const newConversationId = response.data.conversationId;
            setConversationId(newConversationId);
            localStorage.setItem("conversationId", newConversationId); // Save to local storage
            logMessage(`:white_check_mark: Conversation started with ID: ${newConversationId}`);
            return newConversationId;
        } catch (error) {
            logMessage(`:x: Error starting conversation: ${error.message}`);
            return null;
        }
    };
    

    /** 🎙️ Speech Recognition with Azure Speech Services */
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
                    await sendMessageToCopilot(result.text);
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

    /** 📤 Send message to Copilot */
    const sendMessageToCopilot = async (message) => {
        logMessage(`📤 Sending to Copilot: ${message}`);
        if (!message.trim()) {
            logMessage("⚠️ Empty message. Not sending.");
            return;
        }

        const convId = await startConversation();
        if (!convId) {
            logMessage("❌ Could not obtain a valid conversation with Copilot.");
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
                logMessage(`📩 Message sent successfully (ID: ${response.data.id}). Waiting for response...`);
                await waitForBotResponse(convId);
            }
        } catch (error) {
            logMessage(`❌ Error sending message to Copilot: ${error.message}`);
        }
    };

    /** ⏳ Wait for the correct response */
    const waitForBotResponse = async (convId) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < 10000) { // 10 seconds maximum wait time
            const responseReceived = await getBotResponse(convId);
            if (responseReceived) return;
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before rechecking
        }

        logMessage("⚠️ No response received from the bot in 10 seconds.");
    };

    /** 📥 Get bot response */
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

                // 🔹 Avoid duplicate responses
                if (latestBotMessage.timestamp !== lastBotTimestamp) {
                    setLastBotTimestamp(latestBotMessage.timestamp); // 🔄 Update timestamp
                    logMessage(`🤖 Bot response: ${latestBotMessage.text}`);
                    setResponseText(latestBotMessage.text);
                    speakResponse(latestBotMessage.text);
                    return true;
                }
            }

            return false;
        } catch (error) {
            logMessage(`❌ Error getting response from Copilot: ${error.message}`);
            return false;
        }
    };

    /** 🔊 Text-to-Speech with Azure Speech Services */
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
            <h1>🎙️ VoiceBot with Azure Speech & Copilot Studio</h1>
            <button 
                onClick={recognizeSpeech} 
                disabled={isListening} 
                style={{ padding: "10px", fontSize: "16px", cursor: "pointer" }}
            >
                {isListening ? "🎤 Listening..." : "🎙️ Talk to Copilot"}
            </button>

            <h3>📝 Bot's Response:</h3>
            <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>
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
