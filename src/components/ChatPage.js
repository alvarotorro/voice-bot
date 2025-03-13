import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import './ChatPage.css';

// Variables de entorno
const speechKey = process.env.REACT_APP_SPEECH_KEY;
const speechRegion = process.env.REACT_APP_SPEECH_REGION;
const azureOpenAIEndpoint = process.env.REACT_APP_AZURE_OPENAI_ENDPOINT;
const azureOpenAIKey = process.env.REACT_APP_AZURE_OPENAI_KEY;
const deploymentName = process.env.REACT_APP_DEPLOYMENT_NAME;

const ChatPage = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const messagesEndRef = useRef(null);
    const [conversationHistory, setConversationHistory] = useState([
        {
            role: "system",
            content: "You are a customer experiencing issues with Microsoft products. You are asking for support from a Microsoft support agent.",
        },
    ]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    /** 🎙️ Speech Recognition with Azure Speech Services */
    const recognizeSpeech = async () => {
        setIsListening(true);
        addMessage("🎤 Listening...", 'bot');

        try {
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
            speechConfig.speechRecognitionLanguage = "en-US";

            const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            recognizer.recognizeOnceAsync(async (result) => {
                setIsListening(false);

                if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    addMessage(result.text, 'user');
                    await sendMessageToOpenAI(result.text);
                } else {
                    addMessage("⚠️ Speech not recognized.", 'bot');
                }
                recognizer.close();
            });
        } catch (error) {
            setIsListening(false);
            addMessage(`❌ Speech recognition error: ${error.message}`, 'bot');
        }
    };

    /** 📤 Send message to Azure OpenAI */
    const sendMessageToOpenAI = async (message) => {
        if (!message.trim()) {
            addMessage("⚠️ Empty message.", 'bot');
            return;
        }

        const newHistory = [
            ...conversationHistory,
            { role: "user", content: message },
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
            addMessage(botReply, 'bot');
            speakResponse(botReply);

            setConversationHistory([
                ...newHistory,
                { role: "assistant", content: botReply },
            ]);
        } catch (error) {
            addMessage(`❌ Error communicating with Azure OpenAI: ${error.message}`, 'bot');
        }
    };

    /** 🔊 Text-to-Speech with Azure Speech Services */
    const speakResponse = (text) => {
        if (!text.trim()) {
            addMessage("⚠️ No text to synthesize.", 'bot');
            return;
        }

        try {
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
            speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);

            synthesizer.speakTextAsync(
                text,
                () => {
                    synthesizer.close();
                },
                (error) => {
                    addMessage(`❌ Speech synthesis error: ${error.message}`, 'bot');
                    synthesizer.close();
                }
            );
        } catch (error) {
            addMessage(`❌ Unexpected error in speech synthesis: ${error.message}`, 'bot');
        }
    };

    const addMessage = (text, sender) => {
        const newMessage = {
            text,
            sender,
            timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        addMessage(inputMessage, 'user');
        sendMessageToOpenAI(inputMessage);
        setInputMessage('');
    };

    const handleVoiceClick = () => {
        setIsListening(!isListening);
        recognizeSpeech();
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <button className="back-button" onClick={() => navigate('/')}>
                    ←
                </button>
                <div className="header-content">
                    <h2>Microsoft Support Chat</h2>
                    <button 
                        className="info-button"
                        onClick={() => setShowInfo(!showInfo)}
                        title="More information"
                    >
                        i
                    </button>
                </div>
            </div>
            {showInfo && (
                <>
                    <div className="overlay" onClick={() => setShowInfo(false)} />
                    <div className="info-popup">
                        <div className="info-popup-content">
                            <h3 className="popup-title">Scenario Details</h3>
                            <ul className="popup-list">
                                <li><strong>Customer Name & Role:</strong> Lily Reynolds, founder of BrightWave Marketing</li>
                                <li><strong>Company Description:</strong> Helping mid-sized brands with digital marketing, content, and Pay Per Click (PPC) campaigns</li>
                                <li><strong>Customer Location:</strong> Based in Limebrick, UK</li>
                                <li><strong>Tenure:</strong> Customer of Microsoft for over 5 years</li>
                                <li><strong>Microsoft 365 Usage:</strong>
                                    <ul>
                                        <li>20 Microsoft 365 Business Standard licenses</li>
                                        <li>1 Microsoft 365 Copilot license in the tenant</li>
                                    </ul>
                                </li>
                            </ul>
                            <p className="scenario-note">You have set a call with the customer, and you are reaching out to her. This is your first live interaction</p>
                            <div className="scenario-meta">
                                <p className="difficulty">Difficulty: Intermediate</p>
                                <p>Est. Time: 5 mins</p>
                            </div>
                            <button className="close-button" onClick={() => setShowInfo(false)}>×</button>
                        </div>
                    </div>
                </>
            )}
            <div className="messages-container">
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.sender}-message`}>
                        <div className="message-content">
                            <p>{message.text}</p>
                            <span className="timestamp">{message.timestamp}</span>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="input-container">
                <form className="message-form" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        className="message-input"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type your message..."
                    />
                    <div className="button-group">
                        <button
                            type="button"
                            className={`voice-button ${isListening ? 'listening' : ''}`}
                            onClick={handleVoiceClick}
                            disabled={isListening}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            </svg>
                        </button>
                        <button type="submit" className="send-button">
                            Send
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatPage; 