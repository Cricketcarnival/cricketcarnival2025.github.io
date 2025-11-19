import React, { useState, useEffect } from 'react';
import type { Match, Team, Innings, BatsmanScore } from '../../types';
import { WicketType } from '../../types';
import Header from '../ui/Header';
import { pdfService } from '../../services/firebaseService';

interface MatchSummaryScreenProps {
    match: Match;
    teams: Team[];
    navigateBack: () => void;
}

const MatchSummaryScreen: React.FC<MatchSummaryScreenProps> = ({ match, teams, navigateBack }) => {
    const [showCelebration, setShowCelebration] = useState(false);

    useEffect(() => {
        if (match.status === 'completed') {
            const timer = setTimeout(() => setShowCelebration(true), 300);
            return () => clearTimeout(timer);
        }
    }, [match.status]);

    const getPlayerName = (id: string | null | undefined): string => {
        if (!id) return 'N/A';
        const allPlayers = teams.flatMap(t => t.players);
        return allPlayers.find(p => p.id === id)?.name || 'Unknown';
    };

    const getStatusText = (b: BatsmanScore) => {
        if (b.status === 'not out') return 'Not Out';
        if (b.status === 'retired hurt') return 'Retired Hurt';
        if (b.wicketInfo) {
            const bowlerName = getPlayerName(b.wicketInfo.bowlerId);
            const fielderName = b.wicketInfo.fielderId ? getPlayerName(b.wicketInfo.fielderId) : '';
            
            switch (b.wicketInfo.type) {
                case WicketType.Bowled: 
                    return `b ${bowlerName}`;
                case WicketType.LBW: 
                    return `lbw b ${bowlerName}`;
                case WicketType.Caught: 
                    return `c ${fielderName || 'sub'} b ${bowlerName}`;
                case WicketType.Stumped: 
                    return `st ${fielderName || 'sub'} b ${bowlerName}`;
                case WicketType.RunOut: 
                    return `run out (${fielderName || 'sub'})`;
                case WicketType.HitWicket:
                    return `hit wicket b ${bowlerName}`;
                default: 
                    return b.wicketInfo.type;
            }
        }
        return 'Did not bat';
    };

    const handleDownloadPdf = () => {
        const teamAName = teams.find(t=>t.id === match.teamAId)?.shortName || 'TeamA';
        const teamBName = teams.find(t=>t.id === match.teamBId)?.shortName || 'TeamB';
        pdfService.generatePdf('match-summary-content', `Scorecard-${teamAName}-vs-${teamBName}.pdf`);
    };

    const tossWinnerName = teams.find(t => t.id === match.tossWinnerId)?.name || match.tossWinnerId;

    const PrintableInnings = ({ innings, teamName }: { innings: Innings, teamName: string }) => (
        <div className="mb-8">
            <div className="pdf-innings-header">
                 <span className="pdf-innings-title">{teamName} Innings</span>
                 <div className="pdf-innings-score">{innings.score} for {innings.wickets} ({innings.overs.toFixed(1)} Overs)</div>
            </div>

            {/* Batting Table (Green Header) */}
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
                    {innings.batsmen.filter(b => b.status !== 'did not bat').map((b) => (
                        <tr key={b.playerId}>
                            <td style={{ fontWeight: 'bold' }}>{getPlayerName(b.playerId)}</td>
                            <td className="pdf-status-col">{getStatusText(b)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>{b.runs}</td>
                            <td className="text-right">{b.balls}</td>
                            <td className="text-right">{b.fours}</td>
                            <td className="text-right">{b.sixes}</td>
                            <td className="text-right">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(2) : '0.00'}</td>
                        </tr>
                    ))}
                     <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
                        <td colSpan={2}>Extras</td>
                        <td colSpan={5} className="text-left">
                             {innings.extras.total} (b {innings.extras.byes}, lb {innings.extras.legByes}, w {innings.extras.wides}, nb {innings.extras.noBalls}, p {innings.extras.penalties})
                        </td>
                    </tr>
                    <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 'bold', fontSize: '14px' }}>
                        <td colSpan={2}>Total</td>
                        <td colSpan={5} className="text-left">
                             {innings.score} ({innings.wickets} wickets, {innings.overs.toFixed(1)} overs)
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Bowling Table (Dark Header) */}
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '10px 0', textTransform: 'uppercase', color: '#1f2937' }}>Bowling</h3>
            <table className="pdf-table pdf-header-dark">
                <thead>
                    <tr>
                        <th style={{width: '35%'}}>Bowler</th>
                        <th className="pdf-stat-col">O</th>
                        <th className="pdf-stat-col">M</th>
                        <th className="pdf-stat-col">R</th>
                        <th className="pdf-stat-col">W</th>
                        <th className="pdf-stat-col">Nb</th>
                        <th className="pdf-stat-col">Wd</th>
                        <th style={{width: '15%', textAlign: 'right'}}>Econ</th>
                    </tr>
                </thead>
                <tbody>
                    {innings.bowlers.map((b) => {
                        const totalBalls = Math.floor(b.overs) * 6 + Math.round((b.overs % 1) * 10);
                        const economy = totalBalls > 0 ? (b.runs / totalBalls * 6).toFixed(2) : '0.00';
                        return (
                            <tr key={b.playerId}>
                                <td>{getPlayerName(b.playerId)}</td>
                                <td className="text-right">{b.overs.toFixed(1)}</td>
                                <td className="text-right">{b.maidens}</td>
                                <td className="text-right">{b.runs}</td>
                                <td className="text-right" style={{ fontWeight: 'bold' }}>{b.wickets}</td>
                                <td className="text-right">-</td>
                                <td className="text-right">-</td>
                                <td className="text-right">{economy}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Fall of Wickets Table (Green Header) */}
            {innings.fallOfWickets.length > 0 && (
                 <>
                 <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '10px 0', textTransform: 'uppercase', color: '#16a34a' }}>Fall of Wickets</h3>
                 <table className="pdf-table pdf-header-green">
                    <thead>
                        <tr>
                            <th style={{width: '40%'}}>Batsman</th>
                            <th style={{width: '20%'}}>Score</th>
                            <th style={{width: '20%'}}>Over</th>
                            <th style={{width: '20%', textAlign: 'right'}}>Wicket No</th>
                        </tr>
                    </thead>
                    <tbody>
                        {innings.fallOfWickets.map((wicket, index) => (
                            <tr key={index}>
                                <td>{getPlayerName(wicket.playerOutId)}</td>
                                <td>{wicket.totalScore}</td>
                                <td>{wicket.over}.{wicket.ball}</td>
                                <td className="text-right">{index + 1}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </>
            )}
        </div>
    );

    const CelebrationModal = () => {
        if (!showCelebration) return null;
        const confetti = Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="confetti" style={{
                left: `${Math.random() * 100}vw`,
                animationDelay: `${Math.random() * 5}s`,
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
            }}></div>
        ));

        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                {confetti}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden modal-animate w-full max-w-md">
                    <i className="fas fa-trophy text-7xl text-yellow-400 mb-4 animate-bounce"></i>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Congratulations!</h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">{match.result}</p>
                    <button onClick={() => setShowCelebration(false)} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">
                        View Full Summary
                    </button>
                </div>
            </div>
        );
    };

    const teamAName = teams.find(t => t.id === match.teamAId)?.shortName || 'Team A';
    const teamBName = teams.find(t => t.id === match.teamBId)?.shortName || 'Team B';

    return (
        <div className="flex flex-col min-h-screen">
            <CelebrationModal />
            <Header title="Match Summary" onBack={navigateBack} actions={
                <button onClick={handleDownloadPdf} className="text-white hover:bg-blue-700 dark:hover:bg-blue-900 rounded-full p-2">
                    <i className="fas fa-file-pdf"></i>
                </button>
            }/>
            <main className="flex-grow bg-gray-100 dark:bg-gray-900 overflow-y-auto">
                {/* This div is for PDF generation and matches the styling of the demo PDF */}
                <div id="match-summary-content" className="pdf-export-container pdf-container bg-white">
                    <div className="pdf-header-title">{match.result || "Match In Progress"}</div>
                    <div className="pdf-meta-info">
                        <p><strong>Match:</strong> {teamAName} vs {teamBName}</p>
                        <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                        <p><strong>Toss:</strong> {tossWinnerName} won the toss and elected to {match.decision}</p>
                        <p><strong>Venue:</strong> Central Stadium</p>
                    </div>

                    <PrintableInnings 
                        innings={match.innings1} 
                        teamName={teams.find(t=>t.id === match.innings1.battingTeamId)?.name || 'Team A'} 
                    />
                    
                    {match.innings2 && (
                        <PrintableInnings 
                            innings={match.innings2} 
                            teamName={teams.find(t=>t.id === match.innings2.battingTeamId)?.name || 'Team B'} 
                        />
                    )}
                    
                    <div style={{ marginTop: '30px', fontSize: '12px', textAlign: 'center', color: '#6b7280' }}>
                        Generated by Cricket Scorer Admin App
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MatchSummaryScreen;