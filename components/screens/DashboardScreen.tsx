
import React from 'react';
import { Screen } from '../../types';
import Header from '../ui/Header';

interface DashboardScreenProps {
    navigateTo: (screen: Screen) => void;
    onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigateTo, onLogout }) => {

    const menuItems = [
        { name: 'New Match', icon: 'fa-plus', screen: Screen.NewMatch, color: 'bg-green-500' },
        { name: 'Teams', icon: 'fa-users', screen: Screen.TeamsList, color: 'bg-blue-500' },
        { name: 'Tournament', icon: 'fa-trophy', screen: Screen.Tournament, color: 'bg-yellow-500' },
        { name: 'History', icon: 'fa-history', screen: Screen.History, color: 'bg-indigo-500' },
    ];

    return (
        <div className="flex flex-col h-screen">
            <Header title="Dashboard" actions={
                <button onClick={onLogout} className="text-white hover:bg-blue-700 dark:hover:bg-blue-900 rounded-full p-2">
                    <i className="fas fa-sign-out-alt"></i>
                </button>
            } />
            <main className="p-4 flex-grow">
                <div className="grid grid-cols-2 gap-4">
                    {menuItems.map(item => (
                        <button
                            key={item.name}
                            onClick={() => navigateTo(item.screen)}
                            className={`${item.color} text-white font-bold rounded-lg shadow-lg p-6 flex flex-col items-center justify-center aspect-square transform hover:scale-105 transition-transform duration-200`}
                        >
                            <i className={`fas ${item.icon} text-3xl mb-2`}></i>
                            <span>{item.name}</span>
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default DashboardScreen;
