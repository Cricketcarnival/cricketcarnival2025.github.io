
import React, { useState, useEffect, useCallback } from 'react';
import type { Tournament, Team, PointsTableEntry, Match, TournamentGroup, GroupPointsTable } from '../../types';
import Header from '../ui/Header';
import { firebaseService } from '../../services/firebaseService';
import { Screen } from '../../types';

interface TournamentScreenProps {
    teams: Team[];
    navigateTo: (screen: Screen) => void;
    navigateBack: () => void;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({ teams, navigateTo, navigateBack }) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            const fetchedTournaments = await firebaseService.getTournaments();
            setTournaments(fetchedTournaments);
            setLoading(false);
        };
        fetchTournaments();
    }, []);

    const handleCreateTournament = async (name: string, groups: TournamentGroup[]) => {
        if (!name || groups.length === 0) {
            alert("Please provide a name and create at least one group.");
            return;
        }

        if (groups.some(g => g.teamIds.length < 2)) {
            alert("Each group must contain at least two teams to generate fixtures.");
            return;
        }

        const pointsTables: GroupPointsTable[] = groups.map(group => ({
            groupId: group.id,
            entries: group.teamIds.map(teamId => ({
                teamId: teamId,
                matchesPlayed: 0, wins: 0, losses: 0, ties: 0,
                noResult: 0, points: 0, netRunRate: 0,
            }))
        }));

        const fixtures: Match[] = [];
        for (const group of groups) {
            for (let i = 0; i < group.teamIds.length; i++) {
                for (let j = i + 1; j < group.teamIds.length; j++) {
                    const newMatch: Match = {
                        id: `match_${Date.now()}_${i}_${j}`,
                        teamAId: group.teamIds[i],
                        teamBId: group.teamIds[j],
                        overs: 20,
                        tossWinnerId: '',
                        decision: 'bat',
                        status: 'upcoming',
                        innings1: null!,
                        innings2: null,
                        currentInnings: 1,
                        strikerId: null,
                        nonStrikerId: null,
                        currentBowlerId: null,
                        result: undefined,
                        groupId: group.id,
                    };
                    fixtures.push(newMatch);
                }
            }
        }

        const newTournament: Tournament = {
            id: '',
            name,
            groups,
            status: 'upcoming',
            pointsTables,
            fixtures,
        };

        const newId = await firebaseService.saveTournament(newTournament);
        newTournament.id = newId;
        setTournaments(prev => [...prev, newTournament]);
        setIsCreateModalOpen(false);
    };

    const handleSelectTournament = (tournament: Tournament) => {
        setSelectedTournament(tournament);
    };

    const handleUpdateTournament = async (updatedTournament: Tournament) => {
        await firebaseService.saveTournament(updatedTournament);
        setTournaments(prev => prev.map(t => t.id === updatedTournament.id ? updatedTournament : t));
        setSelectedTournament(updatedTournament);
    };


    if (loading) {
        return (
            <div className="flex flex-col h-screen">
                <Header title="Tournaments" onBack={navigateBack} />
                <div className="flex-grow flex items-center justify-center">
                    <i className="fas fa-spinner fa-spin text-3xl"></i>
                </div>
            </div>
        );
    }

    if (selectedTournament) {
        return (
            <TournamentDetailView
                tournament={selectedTournament}
                teams={teams}
                onBack={() => setSelectedTournament(null)}
                onUpdate={handleUpdateTournament}
            />
        );
    }

    return (
        <div className="flex flex-col h-screen">
            <Header title="Tournaments" onBack={navigateBack} />
            <main className="flex-grow p-4 space-y-4">
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-green-700 transition flex items-center justify-center space-x-2"
                >
                    <i className="fas fa-plus"></i>
                    <span>Create New Tournament</span>
                </button>

                {tournaments.length > 0 ? (
                    <div className="space-y-3">
                        {tournaments.map(t => (
                            <TournamentListItem key={t.id} tournament={t} onSelect={handleSelectTournament} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                        <i className="fas fa-trophy text-5xl mb-4"></i>
                        <p>No tournaments found. Create one to get started!</p>
                    </div>
                )}
            </main>
            {isCreateModalOpen && (
                <CreateTournamentModal
                    teams={teams}
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreate={handleCreateTournament}
                />
            )}
        </div>
    );
};

const TournamentListItem: React.FC<{ tournament: Tournament, onSelect: (t: Tournament) => void }> = ({ tournament, onSelect }) => {
    const statusColor = {
        upcoming: 'bg-yellow-500',
        live: 'bg-green-500 animate-pulse',
        completed: 'bg-blue-500',
    };
    return (
        <button
            onClick={() => onSelect(tournament)}
            className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{tournament.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full text-white ${statusColor[tournament.status]}`}>
                        {tournament.status.toUpperCase()}
                    </span>
                </div>
                <p className="text-sm text-gray-500">{tournament.groups.reduce((acc, g) => acc + g.teamIds.length, 0)} Teams, {tournament.groups.length} Groups</p>
            </div>
            <i className="fas fa-chevron-right text-gray-400"></i>
        </button>
    );
};

const CreateTournamentModal: React.FC<{ teams: Team[], onClose: () => void, onCreate: (name: string, groups: TournamentGroup[]) => void }> = ({ teams, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [groups, setGroups] = useState<{ id: string, name: string }[]>([{ id: `g_${Date.now()}`, name: 'Group A' }]);
    const [teamAssignments, setTeamAssignments] = useState<{ [teamId: string]: string | null }>({});

    const addGroup = () => {
        const newGroupName = `Group ${String.fromCharCode(65 + groups.length)}`;
        setGroups(g => [...g, { id: `g_${Date.now()}`, name: newGroupName }]);
    };
    
    const removeGroup = (groupId: string) => {
        setGroups(g => g.filter(group => group.id !== groupId));
        // Un-assign teams from the removed group
        const newAssignments = { ...teamAssignments };
        Object.keys(newAssignments).forEach(teamId => {
            if (newAssignments[teamId] === groupId) {
                newAssignments[teamId] = null;
            }
        });
        setTeamAssignments(newAssignments);
    };

    const updateGroupName = (groupId: string, newName: string) => {
        setGroups(g => g.map(group => group.id === groupId ? { ...group, name: newName } : group));
    };

    const assignTeamToGroup = (teamId: string, groupId: string | null) => {
        setTeamAssignments(a => ({...a, [teamId]: groupId}));
    };

    const handleSubmit = () => {
        const finalGroups: TournamentGroup[] = groups.map(g => ({
            ...g,
            teamIds: Object.keys(teamAssignments).filter(teamId => teamAssignments[teamId] === g.id)
        }));
        onCreate(name, finalGroups);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg flex flex-col" style={{maxHeight: '90vh'}}>
                <h2 className="text-2xl font-bold mb-4">Create Tournament</h2>
                <div className="space-y-4 overflow-y-auto pr-2 flex-grow">
                    <input
                        type="text"
                        placeholder="Tournament Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"
                    />
                    <div>
                        <h3 className="font-semibold mb-2">Manage Groups</h3>
                        <div className="space-y-2">
                        {groups.map((group, index) => (
                             <div key={group.id} className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={group.name}
                                    onChange={e => updateGroupName(group.id, e.target.value)}
                                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"
                                />
                                {index > 0 && <button onClick={() => removeGroup(group.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><i className="fas fa-trash"></i></button>}
                            </div>
                        ))}
                        </div>
                        <button onClick={addGroup} className="text-sm mt-2 text-blue-600 hover:underline">+ Add Another Group</button>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Assign Teams</h3>
                        <div className="space-y-2 p-2 border rounded-md dark:border-gray-600">
                            {teams.map(team => (
                                <div key={team.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span>{team.name}</span>
                                    <select
                                        value={teamAssignments[team.id] || ''}
                                        onChange={e => assignTeamToGroup(team.id, e.target.value || null)}
                                        className="p-1 border rounded-md text-sm bg-gray-50 dark:bg-gray-600"
                                    >
                                        <option value="">Unassigned</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6 pt-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-semibold">Create Tournament</button>
                </div>
            </div>
        </div>
    );
};

const TournamentDetailView: React.FC<{ tournament: Tournament, teams: Team[], onBack: () => void, onUpdate: (t: Tournament) => void }> = ({ tournament, teams, onBack, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'fixtures' | 'pointsTable'>('fixtures');
    const [selectedGroupId, setSelectedGroupId] = useState<string>(tournament.groups[0]?.id);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [matchToUpdate, setMatchToUpdate] = useState<Match | null>(null);

    const getTeamName = useCallback((id: string) => teams.find(t => t.id === id)?.name || 'Unknown', [teams]);

    const handleOpenResultModal = (match: Match) => {
        setMatchToUpdate(match);
        setIsResultModalOpen(true);
    };

    const handleResultSubmit = (matchId: string, winnerId: string | null, resultString: string) => {
        const updatedTournament = JSON.parse(JSON.stringify(tournament));
        const fixture = updatedTournament.fixtures.find((f: Match) => f.id === matchId);
        if (!fixture) return;

        fixture.result = resultString;
        fixture.status = 'completed';
        
        const groupId = fixture.groupId;
        const groupPointsTable = updatedTournament.pointsTables.find((pt: GroupPointsTable) => pt.groupId === groupId);
        if (!groupPointsTable) return;

        const teamAId = fixture.teamAId;
        const teamBId = fixture.teamBId;
        const teamAEntry = groupPointsTable.entries.find((e: PointsTableEntry) => e.teamId === teamAId);
        const teamBEntry = groupPointsTable.entries.find((e: PointsTableEntry) => e.teamId === teamBId);

        if (teamAEntry && teamBEntry) {
            teamAEntry.matchesPlayed += 1;
            teamBEntry.matchesPlayed += 1;

            if (winnerId === teamAId) {
                teamAEntry.wins += 1;
                teamAEntry.points += 2;
                teamBEntry.losses += 1;
            } else if (winnerId === teamBId) {
                teamBEntry.wins += 1;
                teamBEntry.points += 2;
                teamAEntry.losses += 1;
            } else if (winnerId === 'tie') {
                teamAEntry.ties += 1;
                teamBEntry.ties += 1;
                teamAEntry.points += 1;
                teamBEntry.points += 1;
            } else {
                teamAEntry.noResult += 1;
                teamBEntry.noResult += 1;
                teamAEntry.points += 1;
                teamBEntry.points += 1;
            }
        }

        onUpdate(updatedTournament);
        setIsResultModalOpen(false);
        setMatchToUpdate(null);
    };

    return (
        <div className="flex flex-col h-screen">
            <Header title={tournament.name} onBack={onBack} />
            <div className="flex px-4 pt-2 bg-gray-100 dark:bg-gray-900 border-b dark:border-gray-700">
                <button onClick={() => setActiveTab('fixtures')} className={`flex-1 pb-2 font-semibold text-center border-b-4 ${activeTab === 'fixtures' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Fixtures</button>
                <button onClick={() => setActiveTab('pointsTable')} className={`flex-1 pb-2 font-semibold text-center border-b-4 ${activeTab === 'pointsTable' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Points Table</button>
            </div>
            
            <div className="flex-shrink-0 bg-white dark:bg-gray-800/50 p-2 overflow-x-auto border-b dark:border-gray-700">
                <div className="flex space-x-2">
                {tournament.groups.map(group => (
                    <button 
                        key={group.id} 
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${selectedGroupId === group.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                    >
                        {group.name}
                    </button>
                ))}
                </div>
            </div>

            <main className="flex-grow overflow-y-auto p-4">
                {activeTab === 'fixtures' && (
                    <div className="space-y-3">
                        {tournament.fixtures.filter(f => f.groupId === selectedGroupId).map(match => (
                            <div key={match.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow">
                                <p className="font-semibold">{getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}</p>
                                {match.result ? (
                                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{match.result}</p>
                                ) : (
                                    <div className="flex justify-end mt-2">
                                        <button onClick={() => handleOpenResultModal(match)} className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">Enter Result</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'pointsTable' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase">
                                <tr>
                                    <th className="p-3">Team</th>
                                    <th className="text-center p-3">P</th>
                                    <th className="text-center p-3">W</th>
                                    <th className="text-center p-3">L</th>
                                    <th className="text-center p-3">T</th>
                                    <th className="text-center p-3">Pts</th>
                                    <th className="text-center p-3">NRR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tournament.pointsTables.find(pt => pt.groupId === selectedGroupId)?.entries.sort((a, b) => b.points - a.points || b.netRunRate - a.netRunRate).map(entry => (
                                    <tr key={entry.teamId} className="border-b dark:border-gray-700">
                                        <td className="p-3 font-semibold">{getTeamName(entry.teamId)}</td>
                                        <td className="text-center p-3">{entry.matchesPlayed}</td>
                                        <td className="text-center p-3">{entry.wins}</td>
                                        <td className="text-center p-3">{entry.losses}</td>
                                        <td className="text-center p-3">{entry.ties}</td>
                                        <td className="text-center p-3 font-bold">{entry.points}</td>
                                        <td className="text-center p-3">{entry.netRunRate.toFixed(3)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
            {isResultModalOpen && matchToUpdate && (
                <EnterResultModal
                    match={matchToUpdate}
                    teams={teams}
                    onClose={() => setIsResultModalOpen(false)}
                    onSubmit={handleResultSubmit}
                />
            )}
        </div>
    );
};

const EnterResultModal: React.FC<{ match: Match, teams: Team[], onClose: () => void, onSubmit: (matchId: string, winnerId: string | null, result: string) => void }> = ({ match, teams, onClose, onSubmit }) => {
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [result, setResult] = useState('');
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);

    useEffect(() => {
        if (!teamA || !teamB) return;

        if (winnerId === teamA.id) {
            setResult(`${teamA.name} won`);
        } else if (winnerId === teamB.id) {
            setResult(`${teamB.name} won`);
        } else if (winnerId === 'tie') {
            setResult('Match Tied');
        } else if (winnerId === 'no_result') {
            setResult('No Result / Abandoned');
        } else {
            setResult('');
        }
    }, [winnerId, teamA, teamB]);

    const handleSubmit = () => {
        if (!winnerId || !result) {
            alert("Please select a winner and enter the result description.");
            return;
        }
        onSubmit(match.id, winnerId === 'no_result' ? null : winnerId, result);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-2">Enter Match Result</h2>
                <p className="mb-4 font-semibold">{teamA?.name} vs {teamB?.name}</p>
                <div className="space-y-4">
                    <div>
                        <label className="font-semibold">Winner</label>
                        <select onChange={e => setWinnerId(e.target.value)} value={winnerId || ''} className="w-full mt-1 p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                            <option value="" disabled>Select Winner</option>
                            <option value={teamA?.id}>{teamA?.name}</option>
                            <option value={teamB?.id}>{teamB?.name}</option>
                            <option value="tie">Match Tied</option>
                            <option value="no_result">No Result</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-semibold">Result Description</label>
                        <input
                            type="text"
                            placeholder="e.g., Won by 7 wickets"
                            value={result}
                            onChange={e => setResult(e.target.value)}
                            className="w-full mt-1 p-2 border rounded-md bg-gray-50 dark:bg-gray-700"
                        />
                    </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold">Save Result</button>
                </div>
            </div>
        </div>
    );
};

export default TournamentScreen;
