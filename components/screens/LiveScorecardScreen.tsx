import React, { useState, useMemo, useCallback } from 'react';
import type { Match, Team, Innings, BatsmanScore, BowlerScore, Over, Ball, Wicket } from '../../types';
import { Screen, ExtraType, WicketType } from '../../types';
import Header from '../ui/Header';
import { firebaseService, pdfService } from '../../services/firebaseService';

interface LiveScorecardScreenProps {
    initialMatch: Match;
    teams: Team[];
    setMatchState: (match: Match) => void;
    onMatchEnd: (match: Match) => void;
    navigateTo: (screen: Screen) => void;
    onTeamsChange: () => Promise<void>;
}

type ScorecardTab = 'live' | 'summary' | 'ballByBall' | 'fow';

const LiveScorecardScreen: React.FC<LiveScorecardScreenProps> = ({ initialMatch, teams, setMatchState, onMatchEnd, navigateTo, onTeamsChange }) => {
    const [match, setMatch] = useState<Match>(initialMatch);
    const [history, setHistory] = useState<Match[]>([]);
    const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
    const [isNewBowlerModalOpen, setIsNewBowlerModalOpen] = useState(false);
    const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
    const [isRetireModalOpen, setIsRetireModalOpen] = useState(false);
    const [nextBowlerId, setNextBowlerId] = useState('');
    const [wicketDetails, setWicketDetails] = useState({
        type: WicketType.Bowled,
        playerOutId: '',
        fielderId: null as string | null,
        runsOnBall: 0,
        nextBatsmanId: '',
        extraType: null as ExtraType | null,
    });
    const [retireDetails, setRetireDetails] = useState({
        playerOutId: '',
        retireType: 'retired hurt' as 'retired hurt' | 'retired out',
        nextBatsmanId: ''
    });
    const [activeTab, setActiveTab] = useState<ScorecardTab>('live');
    const [isPrinting, setIsPrinting] = useState(false);


    const { battingTeam, bowlingTeam, battingTeamPlayers, bowlingTeamPlayers } = useMemo(() => {
        const currentInningsData = match.currentInnings === 1 ? match.innings1 : match.innings2;
        if (!currentInningsData) return { battingTeam: null, bowlingTeam: null, battingTeamPlayers: [], bowlingTeamPlayers: [] };
        
        const battingTeam = teams.find(t => t.id === currentInningsData.battingTeamId);
        const bowlingTeam = teams.find(t => t.id === currentInningsData.bowlingTeamId);

        return {
            battingTeam,
            bowlingTeam,
            battingTeamPlayers: battingTeam?.players || [],
            bowlingTeamPlayers: bowlingTeam?.players || [],
        };
    }, [match, teams]);

    const currentInnings = useMemo(() => {
        return match.currentInnings === 1 ? match.innings1 : match.innings2;
    }, [match]);
    
    const striker = useMemo(() => currentInnings?.batsmen.find(b => b.playerId === match.strikerId), [currentInnings, match.strikerId]);
    const nonStriker = useMemo(() => currentInnings?.batsmen.find(b => b.playerId === match.nonStrikerId), [currentInnings, match.nonStrikerId]);
    const bowler = useMemo(() => {
      if (!match.currentBowlerId || !currentInnings) return null;
      let bowlerData = currentInnings.bowlers.find(b => b.playerId === match.currentBowlerId);
      if (!bowlerData) {
        return { playerId: match.currentBowlerId, overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 };
      }
      return bowlerData;
    }, [currentInnings, match.currentBowlerId]);

    const getPlayerName = useCallback((id: string | null | undefined) => {
        if (!id) return '';
        const allPlayers = teams.flatMap(t => t.players);
        return allPlayers.find(p => p.id === id)?.name || 'Unknown';
    }, [teams]);

    const getBallDisplay = useCallback((ball: Ball) => {
        if (ball.isWicket) return 'W';
        if (ball.extra) {
           const runPart = ball.extra.runs > 0 ? (ball.extra.type === ExtraType.Wide ? ball.extra.runs -1 : ball.extra.runs) : '';
           return `${runPart || ''}${ball.extra.type}`;
        }
        return String(ball.runs);
    }, []);

    const currentOverHistory = useMemo(() => {
        if (!currentInnings) return '';
        const history = currentInnings.oversHistory.find(o => o.overNumber === Math.floor(currentInnings.overs));
        return history?.balls.map(getBallDisplay).join(' ') || '';
    }, [currentInnings, getBallDisplay]);
    
    const updateMatchState = useCallback((updatedMatch: Match, saveHistory = true) => {
        if (saveHistory) {
            setHistory(prev => [...prev, match]);
        }
        setMatch(updatedMatch);
        setMatchState(updatedMatch);
        firebaseService.syncPublicData(updatedMatch);
    }, [match, setMatchState]);

    const handleUndo = useCallback(() => {
        if (history.length === 0) {
            alert("No actions to undo.");
            return;
        }
        const lastState = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        updateMatchState(lastState, false);
    }, [history, updateMatchState]);

    const determineResult = useCallback((finishedMatch: Match): Match => {
        const finalMatch = JSON.parse(JSON.stringify(finishedMatch));
        finalMatch.status = 'completed';

        const innings1 = finalMatch.innings1;
        const innings2 = finalMatch.innings2;

        if (!innings2) {
            finalMatch.result = "Match abandoned";
            return finalMatch;
        }

        if (innings2.score > innings1.score) {
            const winningTeam = teams.find(t => t.id === innings2.battingTeamId);
            const wicketsInHand = (winningTeam?.players.length || 11) - 1;
            const wicketsRemaining = wicketsInHand - innings2.wickets;
            finalMatch.result = `${winningTeam?.name} won by ${wicketsRemaining} wickets.`;
        } else if (innings2.score < innings1.score) {
            const winningTeam = teams.find(t => t.id === innings1.battingTeamId);
            const runsMargin = innings1.score - innings2.score;
            finalMatch.result = `${winningTeam?.name} won by ${runsMargin} runs.`;
        } else {
            finalMatch.result = "Match tied.";
        }

        return finalMatch;
    }, [teams]);

    const startSecondInnings = useCallback((finishedInnings1Match: Match) => {
        const innings2BattingTeamId = finishedInnings1Match.innings1.bowlingTeamId;
        const battingTeamForInnings2 = teams.find(t => t.id === innings2BattingTeamId);
        if (!battingTeamForInnings2) return;

        const initialBatsmen: BatsmanScore[] = battingTeamForInnings2.players.map(p => ({
            playerId: p.id, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false, status: 'did not bat'
        }));

        const innings2: Innings = {
            battingTeamId: innings2BattingTeamId,
            bowlingTeamId: finishedInnings1Match.innings1.battingTeamId,
            score: 0, wickets: 0, overs: 0, batsmen: initialBatsmen, bowlers: [],
            fallOfWickets: [], oversHistory: [],
            extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
            partnerships: [],
        };

        const matchForInnings2: Match = {
            ...finishedInnings1Match,
            currentInnings: 2,
            innings2: innings2,
            target: finishedInnings1Match.innings1.score + 1,
            strikerId: null,
            nonStrikerId: null,
            currentBowlerId: null,
        };
        
        setMatchState(matchForInnings2);
        navigateTo(Screen.SelectOpeningPlayers);
    }, [teams, setMatchState, navigateTo]);


    const recordDelivery = useCallback((delivery: {
        runs?: number;
        extraType?: ExtraType;
        extraRuns?: number;
        wicket?: {
            type: WicketType;
            playerOutId: string;
            fielderId?: string | null;
        };
        newBatsmanId?: string;
    }) => {
        const newMatch: Match = JSON.parse(JSON.stringify(match));
        const currentInns = newMatch.currentInnings === 1 ? newMatch.innings1 : newMatch.innings2;
        
        if (!currentInns || !newMatch.strikerId || !newMatch.nonStrikerId || !newMatch.currentBowlerId) {
            alert("Error: Player selection is incomplete.");
            return;
        }

        let striker = currentInns.batsmen.find(b => b.playerId === newMatch.strikerId);
        let bowler = currentInns.bowlers.find(b => b.playerId === newMatch.currentBowlerId);

        if (!striker) {
            alert("Error: Striker not found.");
            return;
        }

        if (!bowler) {
            bowler = { playerId: newMatch.currentBowlerId, overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 };
            currentInns.bowlers.push(bowler);
        }
        
        let isLegalBall = true;
        let runsOnBall = delivery.runs ?? 0;
        let runsForBatsman = runsOnBall;
        let runsForBowler = runsOnBall;
        let overCompleted = false;

        const ballEvent: Ball = {
            ballNumber: 0, 
            bowlerId: newMatch.currentBowlerId,
            batsmanId: newMatch.strikerId,
            runs: runsOnBall,
            isWicket: null,
            extra: null,
            timestamp: Date.now(),
        };

        if (delivery.extraType) {
            const extraRuns = delivery.extraRuns ?? 0;
            if (delivery.extraType === ExtraType.Wide) {
                isLegalBall = false;
                const totalWideRuns = 1 + extraRuns;
                currentInns.score += totalWideRuns;
                currentInns.extras.total += totalWideRuns;
                currentInns.extras.wides += totalWideRuns;
                bowler.runs += totalWideRuns;
                runsForBatsman = 0;
                runsOnBall = extraRuns; 
                ballEvent.extra = { type: ExtraType.Wide, runs: totalWideRuns };
            } else if (delivery.extraType === ExtraType.NoBall) {
                isLegalBall = false;
                currentInns.score += 1 + runsOnBall;
                currentInns.extras.total += 1;
                currentInns.extras.noBalls += 1;
                bowler.runs += 1;
                ballEvent.extra = { type: ExtraType.NoBall, runs: 1 + runsOnBall };
            } else if (delivery.extraType === ExtraType.Byes || delivery.extraType === ExtraType.LegByes) {
                currentInns.score += runsOnBall;
                currentInns.extras.total += runsOnBall;
                if(delivery.extraType === ExtraType.Byes) currentInns.extras.byes += runsOnBall;
                else currentInns.extras.legByes += runsOnBall;
                runsForBatsman = 0;
                runsForBowler = 0;
                ballEvent.extra = { type: delivery.extraType, runs: runsOnBall };
            }
        } else {
            currentInns.score += runsOnBall;
        }

        striker.runs += runsForBatsman;
        if(runsForBatsman === 4) striker.fours += 1;
        if(runsForBatsman === 6) striker.sixes += 1;
        bowler.runs += runsForBowler;
        
        if(isLegalBall) striker.balls += 1;

        const overNumberInt = Math.floor(currentInns.overs);
        let currentOver = currentInns.oversHistory.find(o => o.overNumber === overNumberInt);
        if(!currentOver) {
            currentOver = { overNumber: overNumberInt, bowlerId: newMatch.currentBowlerId, balls: [], runsScored: 0 };
            currentInns.oversHistory.push(currentOver);
        }
        
        const legalBallsThisOverBefore = currentOver.balls.filter(b => !b.extra || (b.extra.type !== ExtraType.Wide && b.extra.type !== ExtraType.NoBall)).length;
        ballEvent.ballNumber = legalBallsThisOverBefore + 1;


        if (delivery.wicket) {
            const batsmanOut = currentInns.batsmen.find(b => b.playerId === delivery.wicket!.playerOutId);
            if(batsmanOut) {
                currentInns.wickets += 1;
                batsmanOut.isOut = true;
                batsmanOut.status = 'out';
                const wicketData: Wicket = {
                    ...delivery.wicket,
                    bowlerId: newMatch.currentBowlerId,
                    over: overNumberInt,
                    ball: legalBallsThisOverBefore + 1,
                    totalScore: currentInns.score,
                };
                batsmanOut.wicketInfo = wicketData;
                currentInns.fallOfWickets.push(wicketData);
                ballEvent.isWicket = wicketData;
                
                const bowlerWicketTypes = [WicketType.Bowled, WicketType.Caught, WicketType.LBW, WicketType.Stumped, WicketType.HitWicket];
                if(bowlerWicketTypes.includes(delivery.wicket.type)) {
                    bowler.wickets += 1;
                }
                
                if (delivery.newBatsmanId) {
                    let newBatsman = currentInns.batsmen.find(b => b.playerId === delivery.newBatsmanId);
                    // Handle ad-hoc batsman creation if not already in list
                    if (!newBatsman) {
                        newBatsman = { 
                            playerId: delivery.newBatsmanId, 
                            runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, 
                            isOut: false, status: 'not out' 
                        };
                        currentInns.batsmen.push(newBatsman);
                    }
                    newBatsman.status = 'not out';
                    
                    if (batsmanOut.playerId === newMatch.strikerId) {
                        newMatch.strikerId = delivery.newBatsmanId;
                    } else if (batsmanOut.playerId === newMatch.nonStrikerId) {
                        newMatch.nonStrikerId = delivery.newBatsmanId;
                    }
                } else {
                    if (batsmanOut.playerId === newMatch.strikerId) newMatch.strikerId = null;
                    else newMatch.nonStrikerId = null;
                }
            }
        }

        currentOver.balls.push(ballEvent);
        const legalBallsThisOver = currentOver.balls.filter(b => !b.extra || (b.extra.type !== ExtraType.Wide && b.extra.type !== ExtraType.NoBall)).length;

        if (runsOnBall % 2 !== 0 && (!delivery.extraType || delivery.extraType === ExtraType.Byes || delivery.extraType === ExtraType.LegByes)) {
             [newMatch.strikerId, newMatch.nonStrikerId] = [newMatch.nonStrikerId, newMatch.strikerId];
        }
        
        if(isLegalBall) {
            bowler.overs = parseFloat((Math.floor(bowler.overs) + legalBallsThisOver / 10).toFixed(1));
            currentInns.overs = parseFloat((overNumberInt + legalBallsThisOver / 10).toFixed(1));
            
            if (legalBallsThisOver === 6) {
                currentInns.overs = overNumberInt + 1;
                bowler.overs = Math.floor(bowler.overs) + 1;
                [newMatch.strikerId, newMatch.nonStrikerId] = [newMatch.nonStrikerId, newMatch.strikerId];
                overCompleted = true;
            }
        }
        
        if (newMatch.currentInnings === 2 && currentInns.score >= newMatch.target!) {
            const finalMatch = determineResult(newMatch);
            updateMatchState(finalMatch); 
            onMatchEnd(finalMatch);
            return;
        }

        const maxWickets = (battingTeamPlayers.length || 11) - 1;
        const inningsIsOver = currentInns.wickets >= maxWickets || currentInns.overs >= newMatch.overs;
        
        if (inningsIsOver) {
            if (newMatch.currentInnings === 1) {
                updateMatchState(newMatch);
                setTimeout(() => startSecondInnings(newMatch), 500);
                return; 
            } else {
                const finalMatch = determineResult(newMatch);
                updateMatchState(finalMatch);
                onMatchEnd(finalMatch);
                return;
            }
        }
        
        updateMatchState(newMatch);
        if (overCompleted) {
            setTimeout(() => {
                setNextBowlerId('');
                setIsNewBowlerModalOpen(true);
            }, 100);
        }

    }, [match, battingTeamPlayers, onMatchEnd, updateMatchState, determineResult, startSecondInnings, teams]);

    const handleRuns = (runs: number) => recordDelivery({ runs });
    const handleWide = () => {
        const extraRuns = parseInt(prompt("Runs from byes on wide?", "0") || "0", 10);
        recordDelivery({ extraType: ExtraType.Wide, extraRuns });
    };
    const handleNoBall = () => {
        const runsOffBat = parseInt(prompt("Runs off bat on No Ball?", "0") || "0", 10);
        recordDelivery({ extraType: ExtraType.NoBall, runs: runsOffBat });
    };
    const handleBye = () => {
        const runs = parseInt(prompt("How many Byes?", "1") || "1", 10);
        if (!isNaN(runs)) recordDelivery({ extraType: ExtraType.Byes, runs });
    };
    const handleLegBye = () => {
        const runs = parseInt(prompt("How many Leg Byes?", "1") || "1", 10);
        if (!isNaN(runs)) recordDelivery({ extraType: ExtraType.LegByes, runs });
    };
    const handleWicket = () => {
        setWicketDetails({
            type: WicketType.Bowled,
            playerOutId: match.strikerId || '',
            fielderId: null,
            runsOnBall: 0,
            nextBatsmanId: '',
            extraType: null,
        });
        setIsWicketModalOpen(true);
    };

    const handleConfirmWicket = async () => {
        let finalNextBatsmanId = wicketDetails.nextBatsmanId;
        // @ts-ignore
        const newBatsmanName = wicketDetails.newBatsmanName;

        if (!wicketDetails.type || !wicketDetails.playerOutId) {
             alert("Please fill all wicket details.");
             return;
        }

        const needsFielder = [WicketType.Caught, WicketType.Stumped, WicketType.RunOut].includes(wicketDetails.type);
        if (needsFielder && !wicketDetails.fielderId) {
            alert("Please select a fielder for this dismissal type.");
            return;
        }

        if (newBatsmanName && newBatsmanName.trim() !== '') {
            try {
                 if (!battingTeam) return;
                 const newPlayer = await firebaseService.addPlayerToTeam(battingTeam.id, { name: newBatsmanName, role: 'Batsman' });
                 await onTeamsChange();
                 finalNextBatsmanId = newPlayer.id;
            } catch (e) {
                console.error(e);
                alert("Failed to add new batsman");
                return;
            }
        }

        recordDelivery({
            runs: wicketDetails.extraType !== ExtraType.Wide ? wicketDetails.runsOnBall : 0,
            extraType: wicketDetails.extraType || undefined,
            extraRuns: wicketDetails.extraType === ExtraType.Wide ? wicketDetails.runsOnBall : undefined,
            wicket: {
                type: wicketDetails.type,
                playerOutId: wicketDetails.playerOutId,
                fielderId: wicketDetails.fielderId,
            },
            newBatsmanId: finalNextBatsmanId
        });
        setIsWicketModalOpen(false);
    };

    const handlePenalty = () => setIsPenaltyModalOpen(true);
    
    const handleRetire = () => {
        setRetireDetails({
            playerOutId: match.strikerId || '',
            retireType: 'retired hurt',
            nextBatsmanId: ''
        });
        setIsRetireModalOpen(true);
    };

    const handleConfirmRetire = () => {
        if (!retireDetails.playerOutId) {
            alert("Please select the retiring batsman.");
            return;
        }

        const newMatch = JSON.parse(JSON.stringify(match));
        const currentInns = newMatch.currentInnings === 1 ? newMatch.innings1 : newMatch.innings2;
        if (!currentInns) return;
        
        const retiringBatsman = currentInns.batsmen.find((b: BatsmanScore) => b.playerId === retireDetails.playerOutId);
        if (!retiringBatsman) return;

        const isLastWicket = currentInns.wickets >= (battingTeamPlayers.length || 11) - 2;
        const nextBatsmenAvailable = currentInns.batsmen.filter((b: BatsmanScore) => b.status === 'did not bat').length > 0;
        
        if (!isLastWicket && nextBatsmenAvailable && !retireDetails.nextBatsmanId) {
             alert("Please select the next batsman.");
             return;
        }

        if (retireDetails.retireType === 'retired hurt') {
            retiringBatsman.status = 'retired hurt';
        } else { // retired out
            retiringBatsman.isOut = true;
            retiringBatsman.status = 'out';
            currentInns.wickets += 1;

            const wicketData: Wicket = {
                type: WicketType.RetiredOut,
                playerOutId: retireDetails.playerOutId,
                bowlerId: newMatch.currentBowlerId!,
                over: Math.floor(currentInns.overs),
                ball: (currentInns.overs * 10) % 10,
                totalScore: currentInns.score,
            };
            retiringBatsman.wicketInfo = wicketData;
            currentInns.fallOfWickets.push(wicketData);
        }

        if (retireDetails.nextBatsmanId) {
            const newBatsman = currentInns.batsmen.find((b: BatsmanScore) => b.playerId === retireDetails.nextBatsmanId);
            if (newBatsman) newBatsman.status = 'not out';
            
            if (retireDetails.playerOutId === newMatch.strikerId) {
                newMatch.strikerId = retireDetails.nextBatsmanId;
            } else {
                newMatch.nonStrikerId = retireDetails.nextBatsmanId;
            }
        } else {
            if (retireDetails.playerOutId === newMatch.strikerId) newMatch.strikerId = null;
            else newMatch.nonStrikerId = null;
        }

        const maxWickets = (battingTeamPlayers.length || 11) - 1;
        const inningsIsOver = currentInns.wickets >= maxWickets;
        
        if (inningsIsOver) {
            if (newMatch.currentInnings === 1) {
                updateMatchState(newMatch);
                setTimeout(() => startSecondInnings(newMatch), 500);
            } else {
                const finalMatch = determineResult(newMatch);
                updateMatchState(finalMatch);
                onMatchEnd(finalMatch);
            }
        } else {
            updateMatchState(newMatch);
        }

        setIsRetireModalOpen(false);
    };

    const handleSwapBatsmen = () => {
        const newMatch: Match = JSON.parse(JSON.stringify(match));
        [newMatch.strikerId, newMatch.nonStrikerId] = [newMatch.nonStrikerId, newMatch.strikerId];
        updateMatchState(newMatch);
    };

    const handleDownloadPdf = () => {
        setIsPrinting(true);
        setTimeout(async () => {
            const teamAName = teams.find(t=>t.id === match.teamAId)?.shortName || 'TeamA';
            const teamBName = teams.find(t=>t.id === match.teamBId)?.shortName || 'TeamB';
            await pdfService.generatePdf('pdf-summary-content', `Scorecard-${teamAName}-vs-${teamBName}.pdf`);
            setIsPrinting(false);
        }, 100);
    };

    if (!currentInnings || !battingTeam || !bowlingTeam || !striker || !nonStriker) return <div className="p-4">Loading match data...</div>

    const totalBallsPlayed = Math.floor(currentInnings.overs) * 6 + (currentInnings.overs * 10) % 10;
    const crr = totalBallsPlayed > 0 ? (currentInnings.score / totalBallsPlayed) * 6 : 0;

    let rrr = 0;
    if (match.currentInnings === 2 && match.target) {
        const runsNeeded = match.target - currentInnings.score;
        if (runsNeeded > 0) {
            const ballsRemaining = match.overs * 6 - totalBallsPlayed;
            rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : Infinity;
        }
    }

    const NewBowlerModal = () => {
        const availableBowlers = bowlingTeamPlayers.filter(p => p.id !== match.currentBowlerId);
        const [newBowlerName, setNewBowlerName] = useState('');

        const handleConfirmNewBowler = async () => {
            let finalBowlerId = nextBowlerId;
            
            if (newBowlerName.trim()) {
                try {
                    const newPlayer = await firebaseService.addPlayerToTeam(bowlingTeam.id, { name: newBowlerName, role: 'Bowler' });
                    await onTeamsChange();
                    finalBowlerId = newPlayer.id;
                } catch (error) {
                    console.error("Failed to add bowler", error);
                    alert("Failed to create new bowler");
                    return;
                }
            }

            if (!finalBowlerId) {
                alert("Please select or enter a bowler.");
                return;
            }
            const newMatch: Match = JSON.parse(JSON.stringify(match));
            newMatch.currentBowlerId = finalBowlerId;
            updateMatchState(newMatch);
            setIsNewBowlerModalOpen(false);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-sm m-4">
                    <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">End of Over</h2>
                    <p className="text-center mb-6">Select the next bowler.</p>
                    <select
                        value={nextBowlerId}
                        onChange={e => { setNextBowlerId(e.target.value); setNewBowlerName(''); }}
                        className="w-full p-3 border rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    >
                        <option value="">Select Existing Bowler</option>
                        {availableBowlers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR ADD NEW</span>
                        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                    </div>

                    <input 
                        type="text" 
                        placeholder="Enter New Bowler Name"
                        value={newBowlerName}
                        onChange={e => { setNewBowlerName(e.target.value); setNextBowlerId(''); }}
                        className="w-full p-3 border rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="mt-8">
                        <button
                            onClick={handleConfirmNewBowler}
                            className="w-full px-4 py-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 font-semibold disabled:bg-blue-400 dark:disabled:bg-blue-800 transition"
                        >
                            Confirm & Start Next Over
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const WicketModal = () => {
        const availableNextBatsmen = currentInnings.batsmen.filter(b => b.status === 'did not bat' || b.status === 'retired hurt');
        const needsFielder = [WicketType.Caught, WicketType.Stumped, WicketType.RunOut].includes(wicketDetails.type);
        // @ts-ignore - Using a dynamic property for form handling
        const newBatsmanName = wicketDetails.newBatsmanName || '';

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 overflow-y-auto max-h-screen">
                    <h2 className="text-2xl font-bold mb-6 text-center text-red-600">Record Wicket</h2>
                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium mb-1">Wicket Type</label>
                            <select value={wicketDetails.type} onChange={e => setWicketDetails({...wicketDetails, type: e.target.value as WicketType})} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                                {Object.values(WicketType).map(wt => <option key={wt} value={wt}>{wt.charAt(0).toUpperCase() + wt.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Ball Type</label>
                            <div className="flex space-x-2">
                                <button 
                                    onClick={() => setWicketDetails({...wicketDetails, extraType: null})} 
                                    className={`flex-1 p-2 rounded text-xs ${!wicketDetails.extraType ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    Legal
                                </button>
                                <button 
                                    onClick={() => setWicketDetails({...wicketDetails, extraType: ExtraType.Wide})}
                                    className={`flex-1 p-2 rounded text-xs ${wicketDetails.extraType === ExtraType.Wide ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    Wide
                                </button>
                                <button 
                                    onClick={() => setWicketDetails({...wicketDetails, extraType: ExtraType.NoBall})}
                                    className={`flex-1 p-2 rounded text-xs ${wicketDetails.extraType === ExtraType.NoBall ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    No Ball
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Batsman Out</label>
                            <div className="flex space-x-2">
                                <button onClick={() => setWicketDetails({...wicketDetails, playerOutId: striker.playerId})} className={`flex-1 p-2 rounded ${wicketDetails.playerOutId === striker.playerId ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Striker: {getPlayerName(striker.playerId)}</button>
                                <button onClick={() => setWicketDetails({...wicketDetails, playerOutId: nonStriker.playerId})} className={`flex-1 p-2 rounded ${wicketDetails.playerOutId === nonStriker.playerId ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Non-Striker: {getPlayerName(nonStriker.playerId)}</button>
                            </div>
                        </div>
                         {needsFielder && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Fielder</label>
                                <select value={wicketDetails.fielderId || ''} onChange={e => setWicketDetails({...wicketDetails, fielderId: e.target.value})} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                                    <option value="">Select Fielder</option>
                                    {bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1">Runs on Wicket Ball (e.g., for Run Out)</label>
                            <input type="number" min="0" value={wicketDetails.runsOnBall} onChange={e => setWicketDetails({...wicketDetails, runsOnBall: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700" />
                        </div>
                        
                        <div className="pt-2 border-t dark:border-gray-700">
                             <label className="block text-sm font-medium mb-1">Next Batsman</label>
                             <select 
                                value={wicketDetails.nextBatsmanId} 
                                onChange={e => setWicketDetails({...wicketDetails, nextBatsmanId: e.target.value, newBatsmanName: ''} as any)} 
                                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 mb-2"
                             >
                                <option value="">Select Existing Batsman</option>
                                {availableNextBatsmen.map(p => <option key={p.playerId} value={p.playerId}>{getPlayerName(p.playerId)} ({p.status})</option>)}
                            </select>
                            
                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR ADD NEW</span>
                                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                            </div>

                            <input 
                                type="text" 
                                placeholder="Enter New Batsman Name"
                                value={newBatsmanName}
                                onChange={e => setWicketDetails({...wicketDetails, newBatsmanName: e.target.value, nextBatsmanId: ''} as any)} 
                                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-4 mt-8">
                        <button onClick={() => setIsWicketModalOpen(false)} className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400">Cancel</button>
                        <button onClick={handleConfirmWicket} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-semibold">Confirm Wicket</button>
                    </div>
                </div>
            </div>
        );
    }
    
    const PenaltyModal = () => {
        const [runs, setRuns] = useState(5);
        
        const handleConfirm = () => {
            const newMatch = JSON.parse(JSON.stringify(match));
            const currentInns = newMatch.currentInnings === 1 ? newMatch.innings1 : newMatch.innings2;
            if (!currentInns) return;

            currentInns.score += runs;
            currentInns.extras.total += runs;
            currentInns.extras.penalties = (currentInns.extras.penalties || 0) + runs;
            
            updateMatchState(newMatch);
            setIsPenaltyModalOpen(false);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-sm m-4">
                    <h2 className="text-2xl font-bold mb-4 text-center">Award Penalty Runs</h2>
                    <label className="block text-sm font-medium mb-1">Runs</label>
                    <input type="number" min="1" value={runs} onChange={e => setRuns(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700" />
                    <div className="flex justify-end space-x-4 mt-8">
                        <button onClick={() => setIsPenaltyModalOpen(false)} className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400">Cancel</button>
                        <button onClick={handleConfirm} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold">Confirm</button>
                    </div>
                </div>
            </div>
        )
    }

    const RetireModal = () => {
        const availableNextBatsmen = currentInnings.batsmen.filter(b => b.status === 'did not bat' || b.status === 'retired hurt');

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4">
                    <h2 className="text-2xl font-bold mb-6 text-center">Retire Batsman</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Batsman Retiring</label>
                            <div className="flex space-x-2">
                                <button onClick={() => setRetireDetails({...retireDetails, playerOutId: striker.playerId})} className={`flex-1 p-2 rounded ${retireDetails.playerOutId === striker.playerId ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Striker: {getPlayerName(striker.playerId)}</button>
                                <button onClick={() => setRetireDetails({...retireDetails, playerOutId: nonStriker.playerId})} className={`flex-1 p-2 rounded ${retireDetails.playerOutId === nonStriker.playerId ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Non-Striker: {getPlayerName(nonStriker.playerId)}</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Retirement Type</label>
                             <div className="flex space-x-2">
                                <button onClick={() => setRetireDetails({...retireDetails, retireType: 'retired hurt'})} className={`flex-1 p-2 rounded ${retireDetails.retireType === 'retired hurt' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Retired Hurt</button>
                                <button onClick={() => setRetireDetails({...retireDetails, retireType: 'retired out'})} className={`flex-1 p-2 rounded ${retireDetails.retireType === 'retired out' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Retired Out</button>
                            </div>
                        </div>
                         {availableNextBatsmen.length > 0 && (
                             <div>
                                <label className="block text-sm font-medium mb-1">Next Batsman</label>
                                <select value={retireDetails.nextBatsmanId} onChange={e => setRetireDetails({...retireDetails, nextBatsmanId: e.target.value})} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                                    <option value="">Select Next Batsman</option>
                                    {availableNextBatsmen.map(p => <option key={p.playerId} value={p.playerId}>{getPlayerName(p.playerId)}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end space-x-4 mt-8">
                        <button onClick={() => setIsRetireModalOpen(false)} className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400">Cancel</button>
                        <button onClick={handleConfirmRetire} className="px-4 py-2 rounded bg-teal-600 text-white hover:bg-teal-700 font-semibold">Confirm</button>
                    </div>
                </div>
            </div>
        );
    }
    
    const TabButton = ({ tab, label }: { tab: ScorecardTab, label: string }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex-1 pb-2 text-sm font-semibold text-center transition-all duration-300 border-b-4 ${activeTab === tab ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`}
        >
            {label.toUpperCase()}
        </button>
    );
    
    function SummaryTabContent() {
        return (
            <div className="p-4 space-y-4">
                 <h2 className="text-xl font-bold text-center text-gray-700 dark:text-gray-300">Innings {match.currentInnings}</h2>
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <h3 className="font-bold text-lg mb-2">Scorecard</h3>
                    {/* This simplified view is for quick check, printable one below is detailed */}
                    <p>Use the PDF download button for the full detailed scorecard.</p>
                 </div>
            </div>
        );
    }
    
    function PrintableSummary() {
        const tossWinnerName = teams.find(t => t.id === match.tossWinnerId)?.name;
        const teamAName = teams.find(t=>t.id === match.teamAId)?.shortName || 'Team A';
        const teamBName = teams.find(t=>t.id === match.teamBId)?.shortName || 'Team B';

        const getStatusText = (b: BatsmanScore) => {
            if (b.status === 'not out') return 'Not Out';
            if (b.status === 'retired hurt') return 'Retired Hurt';
            if (b.wicketInfo) {
                const bowlerName = getPlayerName(b.wicketInfo.bowlerId);
                const fielderName = b.wicketInfo.fielderId ? getPlayerName(b.wicketInfo.fielderId) : '';
                switch (b.wicketInfo.type) {
                    case WicketType.Bowled: return `b ${bowlerName}`;
                    case WicketType.LBW: return `lbw b ${bowlerName}`;
                    case WicketType.Caught: return `c ${fielderName || 'sub'} b ${bowlerName}`;
                    case WicketType.Stumped: return `st ${fielderName || 'sub'} b ${bowlerName}`;
                    case WicketType.RunOut: return `run out (${fielderName || 'sub'})`;
                    default: return b.wicketInfo.type;
                }
            }
            return 'Did not bat';
        };
    
        const PrintableInnings = ({ innings, title }: { innings: Innings; title: string }) => (
            <div className="mb-6">
                <div className="pdf-innings-header">
                     <span className="pdf-innings-title">{title}</span>
                     <div className="pdf-innings-score">{innings.score} for {innings.wickets} ({innings.overs.toFixed(1)} Overs)</div>
                </div>

                {/* Batting Table */}
                <table className="pdf-table pdf-header-green">
                    <thead>
                        <tr>
                            <th className="pdf-batsman-col">Batsman</th>
                            <th className="pdf-status-col">Status</th>
                            <th className="pdf-stat-col">R</th>
                            <th className="pdf-stat-col">B</th>
                            <th className="pdf-stat-col">4s</th>
                            <th className="pdf-stat-col">6s</th>
                            <th className="pdf-stat-col">SR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {innings.batsmen.filter(b => b.status !== 'did not bat').map((b, idx) => (
                            <tr key={b.playerId}>
                                <td>{getPlayerName(b.playerId)}</td>
                                <td className="pdf-status-col">{getStatusText(b)}</td>
                                <td className="text-right">{b.runs}</td>
                                <td className="text-right">{b.balls}</td>
                                <td className="text-right">{b.fours}</td>
                                <td className="text-right">{b.sixes}</td>
                                <td className="text-right">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(2) : '0.00'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Bowling Table */}
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '10px 0', textTransform: 'uppercase', color: '#1f2937' }}>Bowling</h3>
                <table className="pdf-table pdf-header-dark">
                    <thead>
                        <tr>
                            <th style={{width: '30%'}}>Bowler</th>
                            <th className="pdf-stat-col">O</th>
                            <th className="pdf-stat-col">M</th>
                            <th className="pdf-stat-col">R</th>
                            <th className="pdf-stat-col">W</th>
                            <th style={{width: '15%', textAlign: 'right'}}>Econ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {innings.bowlers.map((b, idx) => {
                            const totalBalls = Math.floor(b.overs) * 6 + Math.round((b.overs % 1) * 10);
                            const economy = totalBalls > 0 ? (b.runs / totalBalls * 6).toFixed(2) : '0.00';
                            return (
                                <tr key={b.playerId}>
                                    <td>{getPlayerName(b.playerId)}</td>
                                    <td className="text-right">{b.overs.toFixed(1)}</td>
                                    <td className="text-right">{b.maidens}</td>
                                    <td className="text-right">{b.runs}</td>
                                    <td className="text-right">{b.wickets}</td>
                                    <td className="text-right">{economy}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {/* Extras */}
                <div className="pdf-summary-section">
                    Extras: {innings.extras.total} (b {innings.extras.byes}, lb {innings.extras.legByes}, w {innings.extras.wides}, nb {innings.extras.noBalls}, p {innings.extras.penalties})
                </div>

                {/* FOW Table */}
                {innings.fallOfWickets.length > 0 && (
                    <>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '10px 0', textTransform: 'uppercase', color: '#16a34a' }}>Fall of Wickets</h3>
                     <table className="pdf-table pdf-header-green">
                        <thead>
                            <tr>
                                <th style={{width: '15%'}}>Wicket</th>
                                <th style={{width: '35%'}}>Batsman</th>
                                <th style={{width: '25%'}}>Score</th>
                                <th style={{width: '25%'}}>Over</th>
                            </tr>
                        </thead>
                        <tbody>
                            {innings.fallOfWickets.map((wicket, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>{getPlayerName(wicket.playerOutId)}</td>
                                    <td>{wicket.totalScore}-{index+1}</td>
                                    <td>{wicket.over}.{wicket.ball}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </>
                )}
            </div>
        );
    
        return (
            <div id="pdf-summary-content" className="pdf-export-container pdf-container bg-white">
                 <div className="pdf-header-title">{match.result || "Match In Progress"}</div>
                 <div className="pdf-meta-info">
                    <p><strong>Match:</strong> {teamAName} vs {teamBName}</p>
                    <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    <p><strong>Toss:</strong> {tossWinnerName} won the toss and elected to {match.decision}</p>
                    <p><strong>Venue:</strong> Central Stadium</p>
                 </div>

                <PrintableInnings innings={match.innings1} title={`${teams.find(t=>t.id === match.innings1.battingTeamId)?.shortName || 'Team A'} Innings 1`} />
                {match.innings2 && (
                    <PrintableInnings innings={match.innings2} title={`${teams.find(t=>t.id === match.innings2.battingTeamId)?.shortName || 'Team B'} Innings 2`} />
                )}
                <div style={{ marginTop: '30px', fontSize: '12px', textAlign: 'center', color: '#6b7280' }}>
                    Generated by Cricket Scorer Admin App
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
            {isWicketModalOpen && <WicketModal />}
            {isNewBowlerModalOpen && <NewBowlerModal />}
            {isPenaltyModalOpen && <PenaltyModal />}
            {isRetireModalOpen && <RetireModal />}
            {isPrinting && (
                 <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '900px' }}>
                    <PrintableSummary />
                </div>
            )}
            <Header 
                title={`${battingTeam.shortName} vs ${bowlingTeam.shortName}`} 
                actions={
                    <button onClick={handleDownloadPdf} className="text-white hover:bg-blue-700 dark:hover:bg-blue-900 rounded-full p-2">
                        <i className="fas fa-file-pdf"></i>
                    </button>
                }
            />
            
            <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold">{battingTeam.name}</h2>
                    <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">
                        Innings {match.currentInnings}
                    </span>
                </div>
                <div className="text-center my-2">
                    <span className="text-4xl font-bold tracking-tight">{currentInnings.score}</span>
                    <span className="text-2xl font-light">/{currentInnings.wickets}</span>
                    <span className="text-base ml-2">({currentInnings.overs.toFixed(1)} / {match.overs} Ov)</span>
                </div>
                <div className="flex justify-around text-xs text-center">
                    <div>
                        <p className="text-blue-200">CRR</p>
                        <p className="font-bold text-base">{crr.toFixed(2)}</p>
                    </div>
                    {match.currentInnings === 2 && match.target ? (
                    <div>
                        <p className="text-blue-200">Target</p>
                        <p className="font-bold text-base">{match.target}</p>
                    </div>
                    ) : null}
                    {match.currentInnings === 2 && match.target && rrr > 0 ? (
                    <div>
                        <p className="text-blue-200">RRR</p>
                        <p className="font-bold text-base">{rrr === Infinity ? '---' : rrr.toFixed(2)}</p>
                    </div>
                    ) : null}
                </div>
                {match.currentInnings === 2 && match.target && (match.target - currentInnings.score) > 0 && (
                    <div className="text-center font-semibold text-xs pt-2 mt-2 border-t border-white/20">
                        Need {match.target - currentInnings.score} runs in {match.overs * 6 - totalBallsPlayed} balls to win.
                    </div>
                )}
            </div>
            
            <div className="flex px-4 pt-2 bg-gray-100 dark:bg-gray-900">
                <TabButton tab="live" label="Live" />
                <TabButton tab="summary" label="Summary" />
                <TabButton tab="ballByBall" label="Ball by Ball" />
                <TabButton tab="fow" label="FOW" />
            </div>

            <div id="live-scorecard-content" className="flex-grow overflow-y-auto bg-gray-100 dark:bg-gray-900">
                {activeTab === 'live' && <LiveTabContent />}
                {activeTab === 'summary' && <SummaryTabContent />}
                {activeTab === 'ballByBall' && <BallByBallTabContent />}
                {activeTab === 'fow' && <FOWTabContent />}
            </div>
            
            {activeTab === 'live' && <ScoringControls />}
        </div>
    );

    function LiveTabContent() {
        const batsmanSR = (batsman: BatsmanScore) => batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(2) : '0.00';
        const bowlerEcon = (b: BowlerScore | null) => {
            if (!b) return '0.00';
            const totalBalls = Math.floor(b.overs) * 6 + Math.round((b.overs % 1) * 10);
            return totalBalls > 0 ? (b.runs / totalBalls * 6).toFixed(2) : '0.00';
        };
        
        const batsmanRow = (b: BatsmanScore, onStrike: boolean) => (
            <div key={b.playerId} className={`grid grid-cols-12 py-2 px-2 items-center ${onStrike ? 'bg-blue-50 dark:bg-blue-900/50 rounded-md' : ''}`}>
                <div className="col-span-5 flex items-center">
                     <span className={`truncate font-semibold ${onStrike ? 'text-blue-600 dark:text-blue-300' : ''}`}>{getPlayerName(b.playerId)}</span>
                     {onStrike && <i className="fas fa-cricket-ball text-xs ml-2 text-blue-600 dark:text-blue-400 animate-pulse"></i>}
                </div>
                <div className="col-span-1 text-center font-bold">{b.runs}</div>
                <div className="col-span-1 text-center">{b.balls}</div>
                <div className="col-span-1 text-center">{b.fours}</div>
                <div className="col-span-1 text-center">{b.sixes}</div>
                <div className="col-span-3 text-right">{batsmanSR(b)}</div>
            </div>
        );

        return (
             <div className="p-3 space-y-3">
                 <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md">
                    <div className="grid grid-cols-12 text-xs font-bold text-gray-500 dark:text-gray-400 pb-2 border-b dark:border-gray-700">
                        <div className="col-span-5">BATSMAN</div>
                        <div className="col-span-1 text-center">R</div>
                        <div className="col-span-1 text-center">B</div>
                        <div className="col-span-1 text-center">4s</div>
                        <div className="col-span-1 text-center">6s</div>
                        <div className="col-span-3 text-right">SR</div>
                    </div>
                    {striker && batsmanRow(striker, true)}
                    {nonStriker && batsmanRow(nonStriker, false)}
                 </div>

                 <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md">
                    <div className="grid grid-cols-12 text-xs font-bold text-gray-500 dark:text-gray-400 pb-2 border-b dark:border-gray-700">
                        <div className="col-span-5">BOWLER</div>
                        <div className="col-span-1 text-center">O</div>
                        <div className="col-span-1 text-center">M</div>
                        <div className="col-span-1 text-center">R</div>
                        <div className="col-span-1 text-center">W</div>
                        <div className="col-span-3 text-right">ECON</div>
                    </div>
                     <div className="grid grid-cols-12 py-2 px-2 items-center font-semibold">
                        <div className="col-span-5 truncate">{getPlayerName(match.currentBowlerId)}</div>
                        <div className="col-span-1 text-center">{bowler?.overs.toFixed(1) || '0.0'}</div>
                        <div className="col-span-1 text-center">{bowler?.maidens || 0}</div>
                        <div className="col-span-1 text-center">{bowler?.runs || 0}</div>
                        <div className="col-span-1 text-center">{bowler?.wickets || 0}</div>
                        <div className="col-span-3 text-right">{bowlerEcon(bowler)}</div>
                    </div>
                 </div>
                 
                 <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md">
                    <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2">THIS OVER</h3>
                    <div className="flex items-center space-x-2 text-lg font-mono flex-wrap">
                        {currentOverHistory.split(' ').map((ball, i) => ball && (
                            <span key={i} className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                                ${ball.includes('W') ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 
                                  ball === '4' || ball === '6' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 
                                  'bg-gray-200 dark:bg-gray-700'}`
                            }>
                                {ball}
                            </span>
                        )).length > 0 ? currentOverHistory.split(' ').map((ball, i) => ball && (
                            <span key={i} className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                                ${ball.includes('W') ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 
                                  ball === '4' || ball === '6' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 
                                  'bg-gray-200 dark:bg-gray-700'}`
                            }>
                                {ball}
                            </span>
                        )) : <span className="text-sm text-gray-500">First ball of the over...</span>}
                    </div>
                 </div>
            </div>
        );
    }

    function BallByBallTabContent() {
        const reversedOvers = [...currentInnings.oversHistory].reverse();

        if (reversedOvers.length === 0 && currentInnings.overs < 1) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500 dark:text-gray-400">
                    <i className="fas fa-history text-5xl mb-4"></i>
                    <p className="text-lg">No balls have been bowled yet.</p>
                </div>
            )
        }

        const getRunsFromBall = (ball: Ball): number => {
            if (!ball.extra) return ball.runs;
            if (ball.extra.type === ExtraType.Wide) return ball.extra.runs;
            if (ball.extra.type === ExtraType.NoBall) return 1 + ball.runs;
            return ball.runs; // Byes or LegByes
        }

        const getBallDescription = (ball: Ball): string => {
            const batsmanName = getPlayerName(ball.batsmanId);
            
            if (ball.isWicket) {
                const wicket = ball.isWicket;
                const playerOutName = getPlayerName(wicket.playerOutId);
                const bowlerName = getPlayerName(wicket.bowlerId);
                let description = `${playerOutName} ${wicket.type}`;
                
                if ((wicket.type === WicketType.Caught || wicket.type === WicketType.Stumped || wicket.type === WicketType.RunOut) && wicket.fielderId) {
                    if (wicket.type === WicketType.Caught) description += ` c ${getPlayerName(wicket.fielderId)}`;
                    else if (wicket.type === WicketType.Stumped) description += ` st ${getPlayerName(wicket.fielderId)}`;
                    else description += ` (${getPlayerName(wicket.fielderId)})`;
                }

                if (![WicketType.RunOut, WicketType.RetiredOut, WicketType.TimedOut, WicketType.ObstructingField].includes(wicket.type)){
                     description += ` b ${bowlerName}`;
                }
                return description;
            }
            if (ball.extra) {
                const byeRuns = ball.extra.runs - 1;
                switch(ball.extra.type) {
                    case ExtraType.Wide:
                        return `Wide${byeRuns > 0 ? ` & ${byeRuns} bye${byeRuns > 1 ? 's' : ''}` : ''}.`;
                    case ExtraType.NoBall:
                         return `No Ball. ${batsmanName} scores ${ball.runs} run${ball.runs !== 1 ? 's' : ''}.`;
                    case ExtraType.Byes:
                        return `${ball.runs} bye${ball.runs !== 1 ? 's' : ''}.`;
                    case ExtraType.LegByes:
                         return `${ball.runs} leg bye${ball.runs !== 1 ? 's' : ''}.`;
                }
            }
            if (ball.runs === 0) {
                 return `${getPlayerName(ball.bowlerId)} to ${batsmanName}, no run.`;
            }
            return `${getPlayerName(ball.bowlerId)} to ${batsmanName}, ${ball.runs} run${ball.runs !== 1 ? 's' : ''}.`;
        };

        return (
            <div className="p-2 space-y-4">
                {reversedOvers.map(over => {
                    const runsInOver = over.balls.reduce((acc, ball) => acc + getRunsFromBall(ball), 0);
                    
                    return (
                        <div key={over.overNumber} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md">
                            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-2">
                                <div className="flex items-center space-x-2 flex-wrap">
                                    <h4 className="font-bold text-base mr-2">Over {over.overNumber + 1}</h4>
                                    <div className="flex items-center space-x-1">
                                        {over.balls.map((ball, index) => (
                                            <span key={index} className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-mono
                                                ${getBallDisplay(ball) === 'W' ? 'bg-red-500 text-white' : 
                                                getBallDisplay(ball) === '4' || getBallDisplay(ball) === '6' ? 'bg-blue-500 text-white' : 
                                                'bg-gray-200 dark:bg-gray-700'}`
                                            }>
                                                {getBallDisplay(ball)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-sm font-semibold whitespace-nowrap ml-2">
                                    <span className="text-gray-500">{runsInOver} Runs</span>
                                </p>
                            </div>
                            <ul className="space-y-1">
                                {[...over.balls].reverse().map((ball, index) => {
                                    const overDisplay = `${over.overNumber}.${ball.ballNumber}`;
                                    return (
                                        <li key={index} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 w-10 text-center">{overDisplay}</span>
                                            <p className="flex-grow text-sm">{getBallDescription(ball)}</p>
                                            <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0
                                                ${getBallDisplay(ball) === 'W' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 
                                                getBallDisplay(ball) === '4' || getBallDisplay(ball) === '6' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 
                                                'bg-gray-200 dark:bg-gray-700'}`
                                            }>
                                                {getBallDisplay(ball)}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )
                })}
            </div>
        );
    }
    
    function FOWTabContent() {
         return (
             <div className="p-4">
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                     <div className="grid grid-cols-3 p-3 font-bold border-b dark:border-gray-700">
                         <div>Batsman</div>
                         <div className="text-center">Score</div>
                         <div className="text-right">Over</div>
                     </div>
                     <ul>
                        {currentInnings.fallOfWickets.map((wicket, index) => (
                            <li key={index} className="grid grid-cols-3 p-3 border-b dark:border-gray-700 text-sm">
                                <div>{getPlayerName(wicket.playerOutId)}</div>
                                <div className="text-center">{wicket.totalScore}-{index+1}</div>
                                <div className="text-right">{wicket.over}.{wicket.ball}</div>
                            </li>
                        ))}
                     </ul>
                 </div>
             </div>
         );
    }

    function ScoringControls() {
        const controlsDisabled = isNewBowlerModalOpen || isWicketModalOpen || isPenaltyModalOpen || isRetireModalOpen;
        const baseButton = "font-bold text-sm py-1.5 rounded-lg shadow-md transition-transform transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
        const primaryButton = "bg-blue-600 hover:bg-blue-700 text-white";
        const specialButton = "bg-red-600 hover:bg-red-700 text-white";
        const extraButton = "bg-yellow-500 hover:bg-yellow-600 text-white";
        const secondaryButton = "bg-gray-500 hover:bg-gray-600 text-white text-sm";
        const tertiaryButton = "bg-gray-300 hover:bg-gray-400 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-sm";
        
        return (
            <div className="p-2 bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {[0,1,2,3,4,6].map(run => (
                        <button key={run} onClick={() => handleRuns(run)} disabled={controlsDisabled} className={`${baseButton} ${primaryButton}`}>
                            {run}
                        </button>
                    ))}
                     <button onClick={handleWide} disabled={controlsDisabled} className={`${baseButton} ${extraButton}`}>WD</button>
                     <button onClick={handleNoBall} disabled={controlsDisabled} className={`${baseButton} ${extraButton}`}>NB</button>
                </div>
                 <div className="grid grid-cols-4 gap-2 mb-2">
                    <button onClick={handleWicket} disabled={controlsDisabled} className={`${baseButton} ${specialButton} col-span-2`}>WICKET</button>
                    <button onClick={handleSwapBatsmen} disabled={controlsDisabled} className={`${baseButton} ${secondaryButton}`}>SWAP</button>
                    <button onClick={handleUndo} disabled={controlsDisabled || history.length === 0} className={`${baseButton} ${secondaryButton}`}>
                        <i className="fas fa-undo mr-1"></i> UNDO
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <button onClick={handleBye} disabled={controlsDisabled} className={`${baseButton} ${tertiaryButton}`}>Bye</button>
                    <button onClick={handleLegBye} disabled={controlsDisabled} className={`${baseButton} ${tertiaryButton}`}>LB</button>
                    <button onClick={handlePenalty} disabled={controlsDisabled} className={`${baseButton} ${tertiaryButton}`}>Penalty</button>
                    <button onClick={handleRetire} disabled={controlsDisabled} className={`${baseButton} ${tertiaryButton}`}>Retire</button>
                </div>
            </div>
        )
    }
};

export default LiveScorecardScreen;