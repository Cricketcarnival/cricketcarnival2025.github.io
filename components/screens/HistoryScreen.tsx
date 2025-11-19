import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Match, Team } from '../../types';
import Header from '../ui/Header';
import { firebaseService } from '../../services/firebaseService';

interface HistoryScreenProps {
    teams: Team[];
    onSelectMatch: (match: Match) => void;
    navigateBack: () => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ teams, onSelectMatch, navigateBack }) => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const historyMatches = await firebaseService.getMatchHistory();
                setMatches(historyMatches.sort((a, b) => parseInt(b.id.split('_')[1]) - parseInt(a.id.split('_')[1])));
            } catch (error) {
                console.error("Failed to fetch match history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const getTeamInfo = useCallback((teamId: string) => {
        return teams.find(t => t.id === teamId) || { name: 'Unknown', shortName: 'UNK' };
    }, [teams]);

    const playerInfoMap = useMemo(() => {
        const map = new Map<string, { name: string; teamShortName: string }>();
        teams.forEach(team => {
            team.players.forEach(player => {
                map.set(player.id, { name: player.name, teamShortName: team.shortName });
            });
        });
        return map;
    }, [teams]);

    const getPlayerInfo = useCallback((playerId: string) => {
        return playerInfoMap.get(playerId) || { name: 'Unknown Player', teamShortName: 'N/A' };
    }, [playerInfoMap]);


    const formatDate = (matchId: string) => {
        const timestamp = parseInt(matchId.split('_')[1], 10);
        if (isNaN(timestamp)) return 'Unknown Date';
        return new Date(timestamp).toLocaleDateString();
    };

    const MatchCard = ({ match }: { match: Match }) => {
        const teamA = getTeamInfo(match.teamAId);
        const teamB = getTeamInfo(match.teamBId);
        const innings1Team = getTeamInfo(match.innings1.battingTeamId);
        const innings2Team = match.innings2 ? getTeamInfo(match.innings2.battingTeamId) : null;

        const { topScorer, bestBowler } = useMemo(() => {
            let topScorer: { name: string; score: string; teamShortName: string } = { name: 'N/A', score: '-', teamShortName: '' };
            let bestBowler: { name: string; figures: string; teamShortName: string } = { name: 'N/A', figures: '-', teamShortName: '' };

            let highestRuns = -1;
            let bestWickets = -1;
            let leastRunsConcededForBestWickets = Infinity;

            const allInnings = [match.innings1];
            if (match.innings2) allInnings.push(match.innings2);
            
            for (const innings of allInnings) {
                if (!innings) continue;

                // Top Scorer
                for (const batsman of innings.batsmen) {
                    if (batsman.runs > highestRuns) {
                        highestRuns = batsman.runs;
                        const playerInfo = getPlayerInfo(batsman.playerId);
                        topScorer = {
                            name: playerInfo.name,
                            score: `${batsman.runs} (${batsman.balls})`,
                            teamShortName: playerInfo.teamShortName
                        };
                    }
                }

                // Best Bowler
                for (const bowler of innings.bowlers) {
                    if (bowler.wickets > bestWickets || (bowler.wickets === bestWickets && bestWickets > -1 && bowler.runs < leastRunsConcededForBestWickets)) {
                        bestWickets = bowler.wickets;
                        leastRunsConcededForBestWickets = bowler.runs;
                         const playerInfo = getPlayerInfo(bowler.playerId);
                        bestBowler = {
                            name: playerInfo.name,
                            figures: `${bowler.wickets}/${bowler.runs}`,
                            teamShortName: playerInfo.teamShortName
                        };
                    }
                }
            }

            return { topScorer, bestBowler };
        }, [match, getPlayerInfo]);
        
        return (
                <button
                    onClick={() => onSelectMatch(match)}
                    className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gray-600 text-white flex items-center justify-center rounded-full font-bold text-sm">{teamA.shortName}</div>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{teamA.name} vs {teamB.name}</span>
                            <div className="w-8 h-8 bg-gray-600 text-white flex items-center justify-center rounded-full font-bold text-sm">{teamB.shortName}</div>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(match.id)}</span>
                    </div>
                    
                    <div className="my-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md text-center">
                        <p className="font-semibold text-blue-700 dark:text-blue-300">{match.result}</p>
                    </div>
                    
                    <div className="space-y-2 pt-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{innings1Team.name}</span>
                            <div className="font-bold">{match.innings1.score}/{match.innings1.wickets} <span className="font-normal text-gray-500">({match.innings1.overs.toFixed(1)})</span></div>
                        </div>
                        {match.innings2 && innings2Team && (
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">{innings2Team.name}</span>
                                <div className="font-bold">{match.innings2.score}/{match.innings2.wickets} <span className="font-normal text-gray-500">({match.innings2.overs.toFixed(1)})</span></div>
                            </div>
                        )}
                    </div>
                    
                     <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Key Performers</h4>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 text-xs">
                                    <i className="fas fa-medal text-yellow-500"></i>
                                    <span>Top Scorer</span>
                                </p>
                                <p className="font-semibold truncate">{topScorer.name} <span className="text-gray-500">({topScorer.teamShortName})</span></p>
                                <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{topScorer.score}</p>
                            </div>
                             <div>
                                <p className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 text-xs">
                                    <i className="fas fa-medal text-red-500"></i>
                                    <span>Best Bowler</span>
                                </p>
                                <p className="font-semibold truncate">{bestBowler.name} <span className="text-gray-500">({bestBowler.teamShortName})</span></p>
                                <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{bestBowler.figures}</p>
                            </div>
                        </div>
                    </div>
                </button>
        );
    };

    return (
        <div className="flex flex-col h-screen">
            <Header title="Match History" onBack={navigateBack} />
            <main className="flex-grow p-2 bg-gray-100 dark:bg-gray-900 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                    </div>
                ) : matches.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                        <i className="fas fa-folder-open text-5xl mb-4"></i>
                        <p className="text-lg">No completed matches found.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {/* FIX: Moved li with key to wrap MatchCard to resolve TypeScript error and follow React best practices. */}
                        {matches.map(match => (
                            <li key={match.id}>
                                <MatchCard match={match} />
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
};

export default HistoryScreen;