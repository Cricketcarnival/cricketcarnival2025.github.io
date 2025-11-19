
import React, { useState, useMemo } from 'react';
import type { Match, Team } from '../../types';
import Header from '../ui/Header';

interface SelectOpeningPlayersScreenProps {
    match: Match;
    battingTeam: Team;
    bowlingTeam: Team;
    onStartScoring: (match: Match) => void;
    navigateBack: () => void;
}

const SelectOpeningPlayersScreen: React.FC<SelectOpeningPlayersScreenProps> = ({ match, battingTeam, bowlingTeam, onStartScoring, navigateBack }) => {
    const [strikerId, setStrikerId] = useState<string>('');
    const [nonStrikerId, setNonStrikerId] = useState<string>('');
    const [bowlerId, setBowlerId] = useState<string>('');
    
    const availableBatsmen = useMemo(() => battingTeam.players, [battingTeam]);
    const availableBowlers = useMemo(() => bowlingTeam.players, [bowlingTeam]);

    const handleStart = () => {
        if (!strikerId || !nonStrikerId || !bowlerId) {
            alert('Please select all players.');
            return;
        }
        if (strikerId === nonStrikerId) {
            alert('Striker and Non-Striker must be different players.');
            return;
        }

        const updatedMatch: Match = {
            ...match,
            status: 'live',
            strikerId,
            nonStrikerId,
            currentBowlerId: bowlerId,
        };

        const currentInnings = match.currentInnings === 1 ? updatedMatch.innings1 : updatedMatch.innings2;
        if(currentInnings){
            const striker = currentInnings.batsmen.find(b => b.playerId === strikerId);
            const nonStriker = currentInnings.batsmen.find(b => b.playerId === nonStrikerId);
            if(striker) striker.status = 'not out';
            if(nonStriker) nonStriker.status = 'not out';
        }

        onStartScoring(updatedMatch);
    };

    return (
        <div className="flex flex-col h-screen">
            <Header title="Select Opening Players" onBack={navigateBack} />
            <div className="p-4 space-y-6 flex-grow">
                <div>
                    <h2 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">Batting Team: {battingTeam.name}</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Striker</label>
                            <select value={strikerId} onChange={e => setStrikerId(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                                <option value="">Select Striker</option>
                                {availableBatsmen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Non-Striker</label>
                            <select value={nonStrikerId} onChange={e => setNonStrikerId(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                                <option value="">Select Non-Striker</option>
                                {availableBatsmen.filter(p => p.id !== strikerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Bowling Team: {bowlingTeam.name}</h2>
                    <div>
                        <label className="block text-sm font-medium mb-1">Opening Bowler</label>
                        <select value={bowlerId} onChange={e => setBowlerId(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                            <option value="">Select Bowler</option>
                            {availableBowlers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="pt-6">
                    <button onClick={handleStart} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 transition duration-300">
                        Start Scoring
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectOpeningPlayersScreen;
