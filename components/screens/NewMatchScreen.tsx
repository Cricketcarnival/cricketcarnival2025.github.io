import React, { useState, useEffect } from 'react';
import type { Match, Team, Innings, Player, BatsmanScore } from '../../types';
import { Screen } from '../../types';
import Header from '../ui/Header';
import { firebaseService } from '../../services/firebaseService';

interface NewMatchScreenProps {
    teams: Team[];
    onMatchCreate: (match: Match) => void;
    navigateBack: () => void;
}

const NewMatchScreen: React.FC<NewMatchScreenProps> = ({ teams, onMatchCreate, navigateBack }) => {
    const [mode, setMode] = useState<'existing' | 'quick'>('existing');

    // Standard Mode State
    const [teamAId, setTeamAId] = useState<string>('');
    const [teamBId, setTeamBId] = useState<string>('');
    const [overs, setOvers] = useState<number>(20);
    const [tossWinner, setTossWinner] = useState<string>('');
    const [decision, setDecision] = useState<'bat' | 'bowl'>('bat');

    // Quick Mode State
    const [quickTeamAName, setQuickTeamAName] = useState('');
    const [quickTeamBName, setQuickTeamBName] = useState('');
    const [quickTossWinner, setQuickTossWinner] = useState<'A' | 'B'>('A');
    
    const [strikerName, setStrikerName] = useState('');
    const [nonStrikerName, setNonStrikerName] = useState('');
    const [bowlerName, setBowlerName] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Effect to manage Toss Winner selection in Standard Mode
    useEffect(() => {
        const selectedTeams = [teamAId, teamBId].filter(Boolean);
        if (!selectedTeams.includes(tossWinner)) {
            setTossWinner(selectedTeams[0] || '');
        }
    }, [teamAId, teamBId]);

    const handleTeamAChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTeamAId = e.target.value;
        setTeamAId(newTeamAId);
        if (newTeamAId && newTeamAId === teamBId) {
            setTeamBId('');
        }
    };

    const handleStandardSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamAId || !teamBId || teamAId === teamBId) {
            alert('Please select two different teams.');
            return;
        }

        const battingTeamId = (tossWinner === teamAId && decision === 'bat') || (tossWinner === teamBId && decision === 'bowl') ? teamAId : teamBId;
        const bowlingTeamId = battingTeamId === teamAId ? teamBId : teamAId;
        
        const battingTeam = teams.find(t => t.id === battingTeamId);
        if (!battingTeam) return;

        const initialBatsmen: BatsmanScore[] = battingTeam.players.map(p => ({
            playerId: p.id,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            strikeRate: 0,
            isOut: false,
            status: 'did not bat'
        }));

        const innings1: Innings = {
            battingTeamId,
            bowlingTeamId,
            score: 0,
            wickets: 0,
            overs: 0,
            batsmen: initialBatsmen,
            bowlers: [],
            fallOfWickets: [],
            oversHistory: [],
            extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
            partnerships: [],
        };
        
        const newMatch: Match = {
            id: `match_${Date.now()}`,
            teamAId,
            teamBId,
            overs,
            tossWinnerId: tossWinner,
            decision,
            status: 'upcoming',
            innings1,
            innings2: null,
            currentInnings: 1,
            strikerId: null,
            nonStrikerId: null,
            currentBowlerId: null,
        };

        onMatchCreate(newMatch);
    };

    const handleQuickSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickTeamAName.trim() || !quickTeamBName.trim()) {
            alert("Please enter both team names.");
            return;
        }
        if (!strikerName.trim() || !nonStrikerName.trim() || !bowlerName.trim()) {
            alert("Please enter names for Striker, Non-Striker, and Bowler.");
            return;
        }
        
        setIsSubmitting(true);
        try {
            // 1. Create Teams
            const teamA = await firebaseService.saveTeam({ name: quickTeamAName, shortName: quickTeamAName.substring(0, 3).toUpperCase() });
            const teamB = await firebaseService.saveTeam({ name: quickTeamBName, shortName: quickTeamBName.substring(0, 3).toUpperCase() });

            const tossWinnerId = quickTossWinner === 'A' ? teamA.id : teamB.id;
            const battingTeam = ((tossWinnerId === teamA.id && decision === 'bat') || (tossWinnerId === teamB.id && decision === 'bowl')) ? teamA : teamB;
            const bowlingTeam = battingTeam.id === teamA.id ? teamB : teamA;

            // 2. Create Players
            const striker = await firebaseService.addPlayerToTeam(battingTeam.id, { name: strikerName, role: 'Batsman' });
            const nonStriker = await firebaseService.addPlayerToTeam(battingTeam.id, { name: nonStrikerName, role: 'Batsman' });
            const bowler = await firebaseService.addPlayerToTeam(bowlingTeam.id, { name: bowlerName, role: 'Bowler' });

            // 3. Setup Match
            const initialBatsmen: BatsmanScore[] = [
                // Add the created openers first
                { playerId: striker.id, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false, status: 'not out' },
                { playerId: nonStriker.id, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false, status: 'not out' }
            ];

            const innings1: Innings = {
                battingTeamId: battingTeam.id,
                bowlingTeamId: bowlingTeam.id,
                score: 0,
                wickets: 0,
                overs: 0,
                batsmen: initialBatsmen,
                bowlers: [], // Bowler is added when they bowl their first ball in logic, but we set currentBowlerId
                fallOfWickets: [],
                oversHistory: [],
                extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
                partnerships: [],
            };

            const newMatch: Match = {
                id: `match_${Date.now()}`,
                teamAId: teamA.id,
                teamBId: teamB.id,
                overs,
                tossWinnerId,
                decision,
                status: 'live',
                innings1,
                innings2: null,
                currentInnings: 1,
                strikerId: striker.id,
                nonStrikerId: nonStriker.id,
                currentBowlerId: bowler.id,
            };

            onMatchCreate(newMatch);

        } catch (error) {
            console.error("Error creating quick match:", error);
            alert("Failed to start quick match.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const teamA = teams.find(t => t.id === teamAId);
    const teamB = teams.find(t => t.id === teamBId);

    // Helper to determine which inputs are for which team in Quick Mode
    const isTeamABatting = (quickTossWinner === 'A' && decision === 'bat') || (quickTossWinner === 'B' && decision === 'bowl');
    const battingTeamNameLabel = isTeamABatting ? (quickTeamAName || 'Team A') : (quickTeamBName || 'Team B');
    const bowlingTeamNameLabel = isTeamABatting ? (quickTeamBName || 'Team B') : (quickTeamAName || 'Team A');

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
            <Header title="New Match" onBack={navigateBack} />
            
            <div className="p-4 pb-0">
                <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
                    <button 
                        onClick={() => setMode('existing')}
                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'existing' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                        Select Teams
                    </button>
                    <button 
                        onClick={() => setMode('quick')}
                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'quick' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                        Quick Start
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4">
                {mode === 'existing' ? (
                    <form onSubmit={handleStandardSubmit} className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Team A</label>
                                <select value={teamAId} onChange={handleTeamAChange} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                                    <option value="">Select Team A</option>
                                    {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Team B</label>
                                <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                                    <option value="">Select Team B</option>
                                    {teams.filter(t => t.id !== teamAId).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium mb-1">Overs</label>
                                <input type="number" value={overs} onChange={(e) => setOvers(parseInt(e.target.value))} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Toss Won By</label>
                                <select 
                                    value={tossWinner} 
                                    onChange={(e) => setTossWinner(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-800"
                                    disabled={!teamAId || !teamBId}
                                >
                                    {teamA && <option value={teamA.id}>{teamA.name}</option>}
                                    {teamB && <option value={teamB.id}>{teamB.name}</option>}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Decision</label>
                                <div className="flex space-x-4">
                                    <button type="button" onClick={() => setDecision('bat')} className={`flex-1 p-2 rounded-md ${decision === 'bat' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Bat</button>
                                    <button type="button" onClick={() => setDecision('bowl')} className={`flex-1 p-2 rounded-md ${decision === 'bowl' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Bowl</button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 transition duration-300">
                            Next: Select Players
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleQuickSubmit} className="space-y-4">
                         <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b pb-2">Teams</h3>
                            <div>
                                <label className="block text-sm font-medium mb-1">Team A Name</label>
                                <input 
                                    type="text" 
                                    value={quickTeamAName} 
                                    onChange={(e) => setQuickTeamAName(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    placeholder="Enter Team A Name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Team B Name</label>
                                <input 
                                    type="text" 
                                    value={quickTeamBName} 
                                    onChange={(e) => setQuickTeamBName(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    placeholder="Enter Team B Name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Overs</label>
                                <input type="number" value={overs} onChange={(e) => setOvers(parseInt(e.target.value))} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b pb-2">Toss & Decision</h3>
                            <div>
                                <label className="block text-sm font-medium mb-1">Toss Won By</label>
                                <div className="flex space-x-4">
                                    <button type="button" onClick={() => setQuickTossWinner('A')} className={`flex-1 p-2 rounded-md truncate ${quickTossWinner === 'A' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{quickTeamAName || 'Team A'}</button>
                                    <button type="button" onClick={() => setQuickTossWinner('B')} className={`flex-1 p-2 rounded-md truncate ${quickTossWinner === 'B' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{quickTeamBName || 'Team B'}</button>
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium mb-1">Decision</label>
                                <div className="flex space-x-4">
                                    <button type="button" onClick={() => setDecision('bat')} className={`flex-1 p-2 rounded-md ${decision === 'bat' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Bat</button>
                                    <button type="button" onClick={() => setDecision('bowl')} className={`flex-1 p-2 rounded-md ${decision === 'bowl' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Bowl</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
                            <h3 className="font-bold text-green-600 dark:text-green-400 border-b pb-2">Batting: {battingTeamNameLabel}</h3>
                            <div>
                                <label className="block text-sm font-medium mb-1">Striker Name</label>
                                <input 
                                    type="text" 
                                    value={strikerName} 
                                    onChange={(e) => setStrikerName(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    placeholder="Enter Striker Name"
                                    required
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-medium mb-1">Non-Striker Name</label>
                                <input 
                                    type="text" 
                                    value={nonStrikerName} 
                                    onChange={(e) => setNonStrikerName(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    placeholder="Enter Non-Striker Name"
                                    required
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-4">
                            <h3 className="font-bold text-red-600 dark:text-red-400 border-b pb-2">Bowling: {bowlingTeamNameLabel}</h3>
                             <div>
                                <label className="block text-sm font-medium mb-1">Opening Bowler Name</label>
                                <input 
                                    type="text" 
                                    value={bowlerName} 
                                    onChange={(e) => setBowlerName(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    placeholder="Enter Bowler Name"
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 transition duration-300 flex items-center justify-center">
                            {isSubmitting ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                            Start Match Now
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default NewMatchScreen;