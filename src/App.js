import React, { useState, useEffect } from "react";
import axios from "axios";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// Move these to environment variables in a production app
const speechKey = "758a23a13b3f4233b91ab0b69af6af01";
const speechRegion = "westus";

// ⚠️ You'll need to replace this with your refreshed Direct Line token
// The current one is expired (causing 403 errors)
const directLineToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsIng1dCI6IkpHd3R5VFZ6S1Z3ZjVIT0U5YlpqWmNFdjEtbyIsInR5cCI6IkpXVCJ9.eyJib3QiOiJlOTc2ZDZiMC1lMmNkLTFiM2QtNzBlZi0zZTEwZjlmZTVmMDciLCJzaXRlIjoiOFNIaERJaTRyNHlEckwxTlRuYnZHMTVtZjJ6NE1DOHpscTd0Wlp1SHhxek1QN3A4QjhnVEpRUUo5OUJCQUM0ZjFjTUFBcm9oQUFBQkFaQlM0UGRKIiwiY29udiI6IkdPcW5qelRVdWZONXY1NmVLTE5Ebm4tYnIiLCJ1c2VyIjoiNDliM2U4MDMtNzZmNy00YTU1LWJiOTQtMmY5OTJhMzg1NzVjIiwibmJmIjoxNzQwNTg3MzQ3LCJleHAiOjE3NDA1OTA5NDcsImlzcyI6Imh0dHBzOi8vZGlyZWN0bGluZS5ib3RmcmFtZXdvcmsuY29tLyIsImF1ZCI6Imh0dHBzOi8vZGlyZWN0bGluZS5ib3RmcmFtZXdvcmsuY29tLyJ9.FT0xj1ZB47hHXsjO_RhEZtNmwoqPr1MtL0aewBicYk13qQn4gnPoMUVe06gvudQl3k8gGl5dnnmb-I9d8eD1lgptQ76CIq2BvlaRoJxR6VNgGpinx6zINupPFDkd-UzMuU3Sh_oRZc-wxwKKF5FdKGhgXuKGxJgk2repIuRnjV7e0eHq1zaitQ7zm0K2vATRZ23QToL12NroW9wEvIaw6DYws7ovahLEZniCHJeETl4M5OB61dtrmye2FtMBvjSLXHQklncXJO-naH8gy6ib2iu2sNWrO1KUGYw3sFDdCaSNvZmkUDMmxkI_YSO-ttEvCpVW78geNRlEOv9Nh84Qvw";

const VoiceBot = () => {
    const [responseText, setResponseText] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [logs, setLogs] = useState(["🟢 Starting VoiceBot..."]);
    const [conversationId, setConversationId] = useState(null);
    const [lastUserMessageId, setLastUserMessageId] = useState(null);
    const [lastBotTimestamp, setLastBotTimestamp] = useState(""); 
    const [processedResponses, setProcessedResponses] = useState(new Set());
    const [tokenError, setTokenError] = useState(false);

    const logMessage = (msg) => {
        setLogs((prevLogs) => [...prevLogs, msg]);
        console.log(msg);
    };

    // Check if token is valid on component mount
    useEffect(() => {
        verifyToken();
    }, []);

    const verifyToken = async () => {
        try {
            await axios.post(
                "https://directline.botframework.com/v3/directline/conversations",
                {},
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );
            setTokenError(false);
        } catch (error) {
            if (error.response && error.response.status === 403) {
                setTokenError(true);
                logMessage("❌ Direct Line token has expired. Please refresh the token.");
            }
        }
    };

    const startConversation = async () => {
        if (tokenError) {
            logMessage("❌ Cannot start conversation with expired token.");
            return null;
        }
        
        let existingConversationId = "GOqnjzTUufN5v56eKLNDnn-br"
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
            if (error.response && error.response.status === 403) {
                setTokenError(true);
                logMessage("❌ Direct Line token has expired. Please refresh the token.");
            } else {
                logMessage(`:x: Error starting conversation: ${error.message}`);
            }
            return null;
        }
    };
    
    /** 🎙️ Speech Recognition with Azure Speech Services */
    const recognizeSpeech = async () => {
        if (tokenError) {
            logMessage("❌ Cannot listen with expired token. Please refresh the token first.");
            return;
        }
        
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
        if (tokenError) {
            logMessage("❌ Cannot send message with expired token.");
            return;
        }
        
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
                
                // Clear already processed responses
                setProcessedResponses(new Set());
                
                await waitForBotResponse(convId, response.data.id);
            }
        } catch (error) {
            if (error.response && error.response.status === 403) {
                setTokenError(true);
                logMessage("❌ Direct Line token has expired. Please refresh the token.");
            } else {
                logMessage(`❌ Error sending message to Copilot: ${error.message}`);
            }
        }
    };

    /** ⏳ Wait for the correct response */
    const waitForBotResponse = async (convId, messageId) => {
        if (tokenError) return;
        
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 20; // More retries with shorter intervals
        
        while (retryCount < maxRetries) {
            const responseReceived = await getBotResponse(convId, messageId);
            if (responseReceived || tokenError) return;
            
            // Exponential backoff with a max of 1s
            const delay = Math.min(500 * Math.pow(1.2, retryCount), 1000); 
            await new Promise((resolve) => setTimeout(resolve, delay));
            retryCount++;
        }

        logMessage("⚠️ No response received from the bot after multiple attempts.");
    };

    /** 📥 Get bot response */
    const getBotResponse = async (convId, messageId) => {
        if (tokenError) return false;
        
        try {
            const response = await axios.get(
                `https://directline.botframework.com/v3/directline/conversations/${convId}/activities`,
                { headers: { Authorization: `Bearer ${directLineToken}` } }
            );

            const activities = response.data.activities;
            
            // Find bot messages that are responses to the CURRENT message
            const botMessages = activities.filter(
                (act) => act.from.role === "bot" && act.replyToId === messageId
            );

            if (botMessages.length > 0) {
                const latestBotMessage = botMessages[botMessages.length - 1];
                
                // Check if we've already processed this specific message
                if (!processedResponses.has(latestBotMessage.id)) {
                    // Mark this response as processed
                    setProcessedResponses(prev => new Set([...prev, latestBotMessage.id]));
                    
                    logMessage(`🤖 Bot response: ${latestBotMessage.text}`);
                    setResponseText(latestBotMessage.text);
                    speakResponse(latestBotMessage.text);
                    return true;
                }
            }

            return false;
        } catch (error) {
            if (error.response && error.response.status === 403) {
                setTokenError(true);
                logMessage("❌ Direct Line token has expired. Please refresh the token.");
            } else {
                logMessage(`❌ Error getting response from Copilot: ${error.message}`);
            }
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

    // Clear conversation button
    const clearConversation = () => {
        localStorage.removeItem("conversationId");
        setConversationId(null);
        setResponseText("");
        setLogs(["🟢 VoiceBot reset. Conversation cleared."]);
        setProcessedResponses(new Set());
        logMessage("🔄 Ready for a new conversation.");
    };

    return (
        <div style={{ textAlign: "center", marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "10px" }}>
            <h1>🎙️ VoiceBot with Azure Speech & Copilot Studio</h1>
            
            {tokenError && (
                <div style={{ padding: "15px", backgroundColor: "#ffecec", color: "#d8000c", borderRadius: "5px", margin: "15px 0" }}>
                    <strong>⚠️ Token Error:</strong> Your Direct Line token has expired. Please generate a new token and update it in the code.
                </div>
            )}
            
            <div style={{ margin: "20px 0" }}>
                <button 
                    onClick={recognizeSpeech} 
                    disabled={isListening || tokenError} 
                    style={{ 
                        padding: "10px", 
                        fontSize: "16px", 
                        cursor: tokenError ? "not-allowed" : "pointer", 
                        marginRight: "10px",
                        opacity: tokenError ? 0.6 : 1
                    }}
                >
                    {isListening ? "🎤 Listening..." : "🎙️ Talk to Copilot"}
                </button>
                <button 
                    onClick={clearConversation}
                    style={{ padding: "10px", fontSize: "16px", cursor: "pointer", backgroundColor: "#f8f8f8" }}
                >
                    🔄 Reset Conversation
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