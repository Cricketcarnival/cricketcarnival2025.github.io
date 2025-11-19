import type { Team, Player, Match, Tournament } from '../types';

// --- MOCK DATA ---
const MOCK_PLAYERS: Player[] = Array.from({ length: 15 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    role: i % 4 === 0 ? 'Batsman' : i % 4 === 1 ? 'Bowler' : i % 4 === 2 ? 'All-rounder' : 'Wicket-keeper',
    battingStats: {
        matches: Math.floor(Math.random() * 50),
        runs: Math.floor(Math.random() * 2000),
        average: parseFloat((Math.random() * 50).toFixed(2)),
        strikeRate: parseFloat((Math.random() * 100 + 50).toFixed(2)),
        fours: Math.floor(Math.random() * 200),
        sixes: Math.floor(Math.random() * 100),
        fifties: Math.floor(Math.random() * 10),
        hundreds: Math.floor(Math.random() * 3),
        highestScore: Math.floor(Math.random() * 150),
    },
    bowlingStats: {
        matches: Math.floor(Math.random() * 50),
        overs: parseFloat((Math.random() * 100).toFixed(1)),
        wickets: Math.floor(Math.random() * 80),
        runsConceded: Math.floor(Math.random() * 500),
        bestBowling: `${Math.floor(Math.random() * 6)}/${Math.floor(Math.random() * 50)}`,
        economy: parseFloat((Math.random() * 8 + 2).toFixed(2)),
    }
}));


let MOCK_TEAMS: Team[] = [];

let MOCK_MATCHES: Match[] = [];
let MOCK_TOURNAMENTS: Tournament[] = [];

// --- MOCK SERVICE ---
const mockApi = <T,>(data: T, delay = 500): Promise<T> => {
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
};

const mockError = <T,>(message: string, delay = 500): Promise<T> => {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), delay));
}

export const firebaseService = {
    login: async (email: string, pass: string) => {
        if (email === 'admin@scorer.com' && pass === 'password') {
            return mockApi({ uid: 'admin123', email: 'admin@scorer.com' });
        }
        return mockError('Invalid credentials');
    },

    getTeams: async (): Promise<Team[]> => {
        return mockApi(MOCK_TEAMS);
    },

    getTeamById: async (id: string): Promise<Team | undefined> => {
        return mockApi(MOCK_TEAMS.find(t => t.id === id));
    },

    saveTeam: async (teamData: { name: string; shortName: string }): Promise<Team> => {
        const newTeam: Team = {
            id: `team_${Date.now()}`,
            name: teamData.name,
            shortName: teamData.shortName,
            players: [], // New teams start with no players
        };
        MOCK_TEAMS.push(newTeam);
        console.log("Team Saved (Mock):", newTeam);
        return mockApi(newTeam);
    },
    
    updateTeam: async (teamId: string, teamData: { name: string; shortName: string }): Promise<Team> => {
        const team = MOCK_TEAMS.find(t => t.id === teamId);
        if (team) {
            team.name = teamData.name;
            team.shortName = teamData.shortName;
            console.log("Team Updated (Mock):", team);
            return mockApi(team);
        }
        return mockError('Team not found');
    },

    deleteTeam: async (teamId: string): Promise<void> => {
        const index = MOCK_TEAMS.findIndex(t => t.id === teamId);
        if (index > -1) {
            MOCK_TEAMS.splice(index, 1);
        }
        console.log("Team Deleted (Mock):", teamId);
        return mockApi(undefined);
    },
    
    addPlayerToTeam: async (teamId: string, playerData: { name: string; role: Player['role'] }): Promise<Player> => {
        const team = MOCK_TEAMS.find(t => t.id === teamId);
        if (team) {
            const newPlayer: Player = {
                id: `p_${Date.now()}`,
                name: playerData.name,
                role: playerData.role,
                battingStats: { matches: 0, runs: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highestScore: 0 },
                bowlingStats: { matches: 0, overs: 0, wickets: 0, runsConceded: 0, bestBowling: 'N/A', economy: 0 }
            };
            team.players.push(newPlayer);
            console.log("Player Added to Team (Mock):", teamId, newPlayer);
            return mockApi(newPlayer);
        }
        return mockError('Team not found');
    },

    updatePlayerInTeam: async (teamId: string, playerId: string, playerData: { name: string; role: Player['role'] }): Promise<Player> => {
        const team = MOCK_TEAMS.find(t => t.id === teamId);
        if (team) {
            const player = team.players.find(p => p.id === playerId);
            if (player) {
                player.name = playerData.name;
                player.role = playerData.role;
                console.log("Player Updated in Team (Mock):", teamId, player);
                return mockApi(player);
            }
        }
        return mockError('Player or Team not found');
    },

    deletePlayerFromTeam: async (teamId: string, playerId: string): Promise<void> => {
        const team = MOCK_TEAMS.find(t => t.id === teamId);
        if (team) {
            const playerIndex = team.players.findIndex(p => p.id === playerId);
            if (playerIndex > -1) {
                team.players.splice(playerIndex, 1);
                console.log("Player Deleted from Team (Mock):", teamId, playerId);
                return mockApi(undefined);
            }
        }
        return mockError('Player or Team not found');
    },

    saveMatch: async (matchData: Match): Promise<string> => {
        const existingIndex = MOCK_MATCHES.findIndex(m => m.id === matchData.id);
        if (existingIndex > -1) {
            MOCK_MATCHES[existingIndex] = matchData;
        } else {
            matchData.id = `match_${Date.now()}`;
            MOCK_MATCHES.push(matchData);
        }
        console.log("Match Saved (Mock):", matchData);
        return mockApi(matchData.id);
    },

    getMatchHistory: async (): Promise<Match[]> => {
        return mockApi(MOCK_MATCHES.filter(m => m.status === 'completed'));
    },
    
    syncPublicData: async (matchData: Partial<Match>): Promise<void> => {
        console.log("Syncing public data (Mock):", matchData);
        return mockApi(undefined);
    },
    
    getTournaments: async (): Promise<Tournament[]> => {
        return mockApi(MOCK_TOURNAMENTS);
    },

    saveTournament: async (tournamentData: Tournament): Promise<string> => {
        const existingIndex = MOCK_TOURNAMENTS.findIndex(t => t.id === tournamentData.id);
        if (existingIndex > -1) {
            MOCK_TOURNAMENTS[existingIndex] = tournamentData;
        } else {
            tournamentData.id = `tourn_${Date.now()}`;
            MOCK_TOURNAMENTS.push(tournamentData);
        }
        console.log("Tournament Saved (Mock):", tournamentData);
        return mockApi(tournamentData.id);
    },
};

// PDF Generation Service
// Note: Placed here to avoid creating new files under current constraints.
declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

export const pdfService = {
    generatePdf: async (elementId: string, fileName: string, showSpinner = true): Promise<void> => {
        const input = document.getElementById(elementId);
        if (!input || !window.jspdf || !window.html2canvas) {
            alert('PDF generation library is not loaded or content not found.');
            return;
        }
        
        let loadingEl: HTMLDivElement | undefined;
        if (showSpinner) {
            loadingEl = document.createElement('div');
            loadingEl.innerHTML = '<div class="flex items-center justify-center space-x-2"><i class="fas fa-spinner fa-spin text-2xl"></i><span>Generating PDF...</span></div>';
            loadingEl.style.position = 'fixed';
            loadingEl.style.top = '0';
            loadingEl.style.left = '0';
            loadingEl.style.width = '100%';
            loadingEl.style.height = '100%';
            loadingEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
            loadingEl.style.color = 'white';
            loadingEl.style.display = 'flex';
            loadingEl.style.alignItems = 'center';
            loadingEl.style.justifyContent = 'center';
            loadingEl.style.zIndex = '10000';
            loadingEl.style.fontSize = '1.2rem';
            document.body.appendChild(loadingEl);
        }

        try {
            const canvas = await window.html2canvas(input, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.92); // Use JPEG for better compression
            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            const ratio = canvasWidth / pdfWidth;
            const imgHeight = canvasHeight / ratio;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
              position -= pdfHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
              heightLeft -= pdfHeight;
            }
            
            pdf.save(fileName);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert('An error occurred while generating the PDF.');
        } finally {
            if (showSpinner && loadingEl) {
                document.body.removeChild(loadingEl);
            }
        }
    }
};
