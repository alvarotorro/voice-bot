import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
    const navigate = useNavigate();

    const cards = [
        {
            title: "Copilot Welcome",
            description: "Practice handling an initial interaction with a busy customer who just signed up for M365 Copilot.",
            highlight: "Difficulty: Intermediate",
            subtitle: "Est. Time: 5 mins"
        },
        {
            title: "Enterprise Migration",
            description: "Answer questions from a customer who is migrating to Microsoft, but also wants to learn more about AI.",
            highlight: "Difficulty: Advanced",
            subtitle: "Est. Time: 12 mins"
        },
        {
            title: "Reactive Support",
            description: "Address technical issues about Microsoft 365 while maintaining a product-led growth mindset.",
            highlight: "Difficulty: Advanced",
            subtitle: "Est. Time: 10 mins"
        }
    ];

    return (
        <div className="home-container">
            <div className="home-header">
                <h1>PLG Role Play Simulator</h1>
                <p className="subtitle">Master Product Led Growth through realistic customer interactions. Practice handling various scenarios to become a more effective customer support ambassador.</p>
            </div>
            
            <div className="cards-container">
                {cards.map((card, index) => (
                    <div 
                        key={index} 
                        className="card"
                        onClick={() => navigate('/chat')}
                    >
                        <h2>{card.title}</h2>
                        <p className="card-description">{card.description}</p>
                        <p className="card-highlight">{card.highlight}</p>
                        <p className="card-subtitle">{card.subtitle}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HomePage; 