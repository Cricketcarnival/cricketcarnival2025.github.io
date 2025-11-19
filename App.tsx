import React, { useState, useCallback, useEffect } from 'react';
import { Screen, Match, Team } from './types';
import LoginScreen from './components/screens/LoginScreen';
import DashboardScreen from './components/screens/DashboardScreen';
import NewMatchScreen from './components/screens/NewMatchScreen';
import SelectOpeningPlayersScreen from './components/screens/SelectOpeningPlayersScreen';
import LiveScorecardScreen from './components/screens/LiveScorecardScreen';
import MatchSummaryScreen from './components/screens/MatchSummaryScreen';
import TeamsListScreen from './components/screens/TeamsListScreen';
import TeamDetailsScreen from './components/screens/TeamDetailsScreen';
import HistoryScreen from './components/screens/HistoryScreen';
import TournamentScreen from './components/screens/TournamentScreen';
import { firebaseService } from './services/firebaseService';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.Login);
    const [screenStack, setScreenStack] = useState<Screen[]>([]);
    
    const [match, setMatch] = useState<Match | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    
    const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null;

    const reloadTeams = useCallback(async () => {
        const fetchedTeams = await firebaseService.getTeams();
        // CRITICAL FIX: Spread to create new array reference. 
        // Without this, React compares the array reference, sees it's the same (from mock service), and skips re-render.
        setTeams([...fetchedTeams]);
    }, []);

    useEffect(() => {
        if(isAuthenticated) {
            reloadTeams();
        }
    }, [isAuthenticated, reloadTeams]);

    const navigateTo = useCallback((screen: Screen) => {
        setScreenStack(prev => [...prev, currentScreen]);
        setCurrentScreen(screen);
    }, [currentScreen]);

    const navigateBack = useCallback(() => {
        const lastScreen = screenStack[screenStack.length - 1];
        if (lastScreen !== undefined) {
            setScreenStack(prev => prev.slice(0, -1));
            setCurrentScreen(lastScreen);
        }
    }, [screenStack]);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
        navigateTo(Screen.Dashboard);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setMatch(null);
        setTeams([]);
        setCurrentScreen(Screen.Login);
        setScreenStack([]);
    };

    const handleNewMatch = (newMatch: Match) => {
        setMatch(newMatch);
        // If it's a quick match, the players are already set, so go straight to scoring
        if (newMatch.strikerId && newMatch.nonStrikerId && newMatch.currentBowlerId) {
            // We need to reload teams because new teams/players were created in NewMatchScreen
            reloadTeams().then(() => {
                navigateTo(Screen.LiveScorecard);
            });
        } else {
            navigateTo(Screen.SelectOpeningPlayers);
        }
    }
    
    const handleStartScoring = (updatedMatch: Match) => {
        setMatch(updatedMatch);
        navigateTo(Screen.LiveScorecard);
    }
    
    const handleViewTeam = (team: Team) => {
        setSelectedTeamId(team.id);
        navigateTo(Screen.TeamDetails);
    }
    
    const handleMatchEnd = (finishedMatch: Match) => {
      setMatch(finishedMatch);
      setScreenStack([Screen.Dashboard]);
      setCurrentScreen(Screen.MatchSummary);
    }

    const handleViewMatchHistory = (historicalMatch: Match) => {
        setMatch(historicalMatch);
        navigateTo(Screen.MatchSummary);
    };


    const renderScreen = () => {
        if (!isAuthenticated) {
            return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
        }

        switch (currentScreen) {
            case Screen.Dashboard:
                return <DashboardScreen navigateTo={navigateTo} onLogout={handleLogout} />;
            case Screen.NewMatch:
                return <NewMatchScreen teams={teams} onMatchCreate={handleNewMatch} navigateBack={navigateBack} />;
            case Screen.SelectOpeningPlayers:
                if (!match || !teams.length) return <div>Loading...</div>;
                const battingTeam = teams.find(t => t.id === (match.currentInnings === 1 ? match.innings1.battingTeamId : match.innings2?.battingTeamId));
                const bowlingTeam = teams.find(t => t.id === (match.currentInnings === 1 ? match.innings1.bowlingTeamId : match.innings2?.bowlingTeamId));
                if(!battingTeam || !bowlingTeam) return <div>Team not found</div>;
                return <SelectOpeningPlayersScreen match={match} battingTeam={battingTeam} bowlingTeam={bowlingTeam} onStartScoring={handleStartScoring} navigateBack={navigateBack} />;
            case Screen.LiveScorecard:
                 if (!match || !teams.length) return <div>Loading...</div>;
                 return <LiveScorecardScreen initialMatch={match} teams={teams} setMatchState={setMatch} onMatchEnd={handleMatchEnd} navigateTo={navigateTo} onTeamsChange={reloadTeams}/>
            case Screen.TeamsList:
                return <TeamsListScreen teams={teams} onSelectTeam={handleViewTeam} navigateBack={navigateBack} onTeamsChange={reloadTeams} />;
            case Screen.TeamDetails:
                if (!selectedTeam) {
                    // If team was deleted, it might become null. Navigate back.
                    if (screenStack.length > 0) {
                        // Use setTimeout to avoid render-phase update warnings
                        setTimeout(() => navigateBack(), 0);
                    }
                    return <div>No team selected or team has been deleted.</div>
                }
                return <TeamDetailsScreen team={selectedTeam} navigateBack={navigateBack} onTeamsChange={reloadTeams} />;
            case Screen.History:
                return <HistoryScreen teams={teams} onSelectMatch={handleViewMatchHistory} navigateBack={navigateBack} />;
            case Screen.MatchSummary:
                if (!match) return <div>No match data</div>
                return <MatchSummaryScreen match={match} teams={teams} navigateBack={navigateBack}/>;
            case Screen.Tournament:
                return <TournamentScreen teams={teams} navigateTo={navigateTo} navigateBack={navigateBack} />;
            default:
                return <DashboardScreen navigateTo={navigateTo} onLogout={handleLogout} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-sans">
            <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 shadow-lg min-h-screen">
                {renderScreen()}
            </div>
        </div>
    );
};

export default App;