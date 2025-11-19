
import React, { useState } from 'react';
import type { Team, Player, BattingStats, BowlingStats } from '../../types';
import Header from '../ui/Header';
import { firebaseService } from '../../services/firebaseService';

interface TeamDetailsScreenProps {
    team: Team;
    navigateBack: () => void;
    onTeamsChange: () => void;
}

const getPlayerRoleIcon = (role: Player['role']) => {
    switch (role) {
        case 'Batsman': return 'fa-user';
        case 'Bowler': return 'fa-bullseye';
        case 'All-rounder': return 'fa-sync-alt';
        case 'Wicket-keeper': return 'fa-mitten';
        default: return 'fa-user-circle';
    }
};

const TeamDetailsScreen: React.FC<TeamDetailsScreenProps> = ({ team, navigateBack, onTeamsChange }) => {
    const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
    const [activeStatTab, setActiveStatTab] = useState<'batting' | 'bowling'>('batting');
    const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

    const handlePlayerClick = (playerId: string) => {
        if (expandedPlayerId === playerId) {
            setExpandedPlayerId(null);
        } else {
            setExpandedPlayerId(playerId);
            setActiveStatTab('batting');
        }
    };

    const handleAddPlayer = async (name: string, role: Player['role']) => {
        try {
            await firebaseService.addPlayerToTeam(team.id, { name, role });
            onTeamsChange();
            setIsPlayerModalOpen(false);
        } catch (error) {
            console.error("Failed to add player:", error);
            alert("Could not add player. Please try again.");
        }
    };

    const handleEditPlayer = async (playerId: string, name: string, role: Player['role']) => {
        try {
            await firebaseService.updatePlayerInTeam(team.id, playerId, { name, role });
            onTeamsChange();
            setEditingPlayer(null);
        } catch (error) {
            console.error("Failed to update player:", error);
            alert("Could not update player. Please try again.");
        }
    };
    
    const handleDeletePlayer = async (playerId: string) => {
        if (window.confirm('Are you sure you want to delete this player from the team?')) {
            try {
                await firebaseService.deletePlayerFromTeam(team.id, playerId);
                onTeamsChange();
            } catch (error) {
                console.error("Failed to delete player:", error);
                alert("Could not delete player. Please try again.");
            }
        }
    };

    const handleDeleteTeam = async () => {
        if (window.confirm('Are you sure you want to delete this entire team? This action is permanent and cannot be undone.')) {
            try {
                await firebaseService.deleteTeam(team.id);
                // The navigateBack will show the updated list because the parent state will change
                navigateBack(); 
                onTeamsChange();
            } catch (error) {
                console.error("Failed to delete team:", error);
                alert("Could not delete team. Please try again.");
            }
        }
    };

    return (
        <div className="flex flex-col h-screen">
            <Header 
                title={team.name} 
                onBack={navigateBack}
                actions={
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setIsPlayerModalOpen(true)} className="text-white hover:bg-blue-700 dark:hover:bg-blue-900 rounded-full p-2">
                            <i className="fas fa-user-plus"></i>
                        </button>
                        <button onClick={handleDeleteTeam} className="text-white hover:bg-red-700 dark:hover:bg-red-900 rounded-full p-2">
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                } 
            />
            <main className="flex-grow p-2 overflow-y-auto">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4">
                    <h2 className="text-xl font-bold">{team.name} ({team.shortName})</h2>
                    <p className="text-gray-500">{team.players.length} Players</p>
                </div>
                
                <h3 className="px-2 font-bold text-lg mb-2">Squad</h3>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {team.players.map(player => (
                            <div key={player.id}>
                                <div 
                                    className="p-3 flex items-center text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    onClick={() => handlePlayerClick(player.id)}
                                >
                                    <div className="w-10 text-center text-gray-500 dark:text-gray-400">
                                        <i className={`fas ${getPlayerRoleIcon(player.role)} text-lg`}></i>
                                    </div>
                                    <div className="flex-grow">
                                        <p className="font-semibold">{player.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{player.role}</p>
                                    </div>
                                    <i className={`fas fa-chevron-down transform transition-transform ${expandedPlayerId === player.id ? 'rotate-180' : ''}`}></i>
                                </div>
                                {expandedPlayerId === player.id && (
                                    <div className="p-3 bg-gray-100 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex mb-3 border-b border-gray-300 dark:border-gray-600">
                                            <button onClick={() => setActiveStatTab('batting')} className={`flex-1 py-2 text-sm font-semibold ${activeStatTab === 'batting' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500'}`}>Batting</button>
                                            <button onClick={() => setActiveStatTab('bowling')} className={`flex-1 py-2 text-sm font-semibold ${activeStatTab === 'bowling' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500'}`}>Bowling</button>
                                        </div>
                                        {activeStatTab === 'batting' ? <BattingStatsView stats={player.battingStats} /> : <BowlingStatsView stats={player.bowlingStats} />}
                                        <div className="mt-4 flex justify-end space-x-2">
                                            <button onClick={() => setEditingPlayer(player)} className="text-sm px-3 py-1 rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900">
                                                <i className="fas fa-edit mr-1.5"></i> Edit
                                            </button>
                                            <button onClick={() => handleDeletePlayer(player.id)} className="text-sm px-3 py-1 rounded-md bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900">
                                                <i className="fas fa-trash mr-1.5"></i> Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            {isPlayerModalOpen && <PlayerModal onClose={() => setIsPlayerModalOpen(false)} onSave={handleAddPlayer} />}
            {editingPlayer && <PlayerModal player={editingPlayer} onClose={() => setEditingPlayer(null)} onSave={(name, role) => handleEditPlayer(editingPlayer.id, name, role)} />}
        </div>
    );
};

const StatBox: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg text-center shadow">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="font-bold text-xl text-gray-800 dark:text-gray-100">{value}</p>
    </div>
);

const BattingStatsView: React.FC<{ stats: BattingStats }> = ({ stats }) => (
    <div className="grid grid-cols-3 gap-2">
        <StatBox label="Matches" value={stats.matches} />
        <StatBox label="Runs" value={stats.runs} />
        <StatBox label="Highest" value={stats.highestScore} />
        <StatBox label="Average" value={stats.average} />
        <StatBox label="Strike Rate" value={stats.strikeRate} />
        <StatBox label="100s" value={stats.hundreds} />
        <StatBox label="50s" value={stats.fifties} />
        <StatBox label="6s" value={stats.sixes} />
        <StatBox label="4s" value={stats.fours} />
    </div>
);

const BowlingStatsView: React.FC<{ stats: BowlingStats }> = ({ stats }) => (
    <div className="grid grid-cols-3 gap-2">
        <StatBox label="Matches" value={stats.matches} />
        <StatBox label="Wickets" value={stats.wickets} />
        <StatBox label="Overs" value={stats.overs} />
        <StatBox label="Runs" value={stats.runsConceded} />
        <StatBox label="Economy" value={stats.economy} />
        <StatBox label="Best" value={stats.bestBowling} />
    </div>
);


const PlayerModal: React.FC<{ 
    player?: Player | null;
    onClose: () => void; 
    onSave: (name: string, role: Player['role']) => void; 
}> = ({ player, onClose, onSave }) => {
    const [name, setName] = useState(player?.name || '');
    const [role, setRole] = useState<Player['role']>(player?.role || 'Batsman');
    const isEditing = !!player;

    const handleSaveClick = () => {
        if (!name.trim()) {
            alert("Player name is required.");
            return;
        }
        onSave(name, role);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">{isEditing ? 'Edit Player' : 'Add New Player'}</h2>
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Full Player Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-3 border rounded-md bg-gray-50 dark:bg-gray-700"
                    />
                    <select
                        value={role}
                        onChange={e => setRole(e.target.value as Player['role'])}
                        className="w-full p-3 border rounded-md bg-gray-50 dark:bg-gray-700"
                    >
                        <option value="Batsman">Batsman</option>
                        <option value="Bowler">Bowler</option>
                        <option value="All-rounder">All-rounder</option>
                        <option value="Wicket-keeper">Wicket-keeper</option>
                    </select>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 hover:bg-gray-400">Cancel</button>
                    <button onClick={handleSaveClick} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 font-semibold">Save Player</button>
                </div>
            </div>
        </div>
    );
};

export default TeamDetailsScreen;
