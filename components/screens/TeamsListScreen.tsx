import React, { useState } from 'react';
import type { Team } from '../../types';
import Header from '../ui/Header';
import { firebaseService } from '../../services/firebaseService';

interface TeamsListScreenProps {
    teams: Team[];
    onSelectTeam: (team: Team) => void;
    navigateBack: () => void;
    onTeamsChange: () => void;
}

const TeamsListScreen: React.FC<TeamsListScreenProps> = ({ teams, onSelectTeam, navigateBack, onTeamsChange }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);

    const handleSaveTeam = async (name: string, shortName: string) => {
        if (!name.trim() || !shortName.trim()) {
            alert("Team Name and Short Name are required.");
            return;
        }
        try {
            await firebaseService.saveTeam({ name, shortName });
            onTeamsChange();
            setIsAddModalOpen(false);
        } catch (error) {
            console.error("Failed to save team:", error);
            alert("Could not save the new team. Please try again.");
        }
    };
    
    const handleUpdateTeam = async (name: string, shortName: string) => {
        if (!editingTeam) return;
        try {
            await firebaseService.updateTeam(editingTeam.id, { name, shortName });
            onTeamsChange();
            setEditingTeam(null);
        } catch (error) {
            console.error("Failed to update team:", error);
            alert("Could not update team. Please try again.");
        }
    };
    
    const handleDeleteTeam = async (teamId: string) => {
        if (window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
            try {
                await firebaseService.deleteTeam(teamId);
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
                title="Teams" 
                onBack={navigateBack}
                actions={
                    <button onClick={() => setIsAddModalOpen(true)} className="text-white hover:bg-blue-700 dark:hover:bg-blue-900 rounded-full p-2">
                        <i className="fas fa-plus"></i>
                    </button>
                }
            />
            <main className="flex-grow p-2">
                {teams.length > 0 ? (
                    <ul className="space-y-2">
                        {teams.map(team => (
                            <li key={team.id} className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-center justify-between space-x-4">
                                <button onClick={() => onSelectTeam(team)} className="flex-grow flex items-center space-x-4 text-left">
                                    <div className="w-10 h-10 bg-blue-500 text-white flex items-center justify-center rounded-full font-bold text-lg flex-shrink-0">
                                        {team.shortName}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg">{team.name}</p>
                                    </div>
                                </button>
                                <div className="flex items-center space-x-3 flex-shrink-0">
                                    <button onClick={() => setEditingTeam(team)} className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label={`Edit ${team.name}`}>
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button onClick={() => handleDeleteTeam(team.id)} className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label={`Delete ${team.name}`}>
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                        <i className="fas fa-users-slash text-5xl mb-4"></i>
                        <p className="text-lg font-semibold">No Teams Found</p>
                        <p>Click the '+' button to add your first team.</p>
                    </div>
                )}
            </main>
            {(isAddModalOpen || editingTeam) && (
                <TeamModal
                    team={editingTeam}
                    onClose={() => { setIsAddModalOpen(false); setEditingTeam(null); }}
                    onSave={editingTeam ? handleUpdateTeam : handleSaveTeam}
                />
            )}
        </div>
    );
};

const TeamModal: React.FC<{
    team?: Team | null;
    onClose: () => void;
    onSave: (name: string, shortName: string) => void;
}> = ({ team, onClose, onSave }) => {
    const [name, setName] = useState(team?.name || '');
    const [shortName, setShortName] = useState(team?.shortName || '');
    
    const handleSaveClick = () => {
        onSave(name, shortName);
    };

    const isEditing = !!team;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">{isEditing ? 'Edit Team' : 'Add New Team'}</h2>
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Full Team Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-3 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="text"
                        placeholder="Short Name (e.g., MI, CSK)"
                        maxLength={4}
                        value={shortName}
                        onChange={e => setShortName(e.target.value.toUpperCase())}
                        className="w-full p-3 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 transition">Cancel</button>
                    <button onClick={handleSaveClick} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 font-semibold transition">Save Team</button>
                </div>
            </div>
        </div>
    );
};


export default TeamsListScreen;