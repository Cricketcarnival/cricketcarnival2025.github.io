
export enum Screen {
  Login,
  Dashboard,
  NewMatch,
  SelectOpeningPlayers,
  LiveScorecard,
  MatchSummary,
  OverByOver,
  TeamsList,
  TeamDetails,
  PlayerStats,
  Tournament,
  History,
  AdvancedSettings
}

export interface BattingStats {
  matches: number;
  runs: number;
  average: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highestScore: number;
}

export interface BowlingStats {
  matches: number;
  overs: number;
  wickets: number;
  runsConceded: number;
  bestBowling: string;
  economy: number;
}

export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper';
  battingStats: BattingStats;
  bowlingStats: BowlingStats;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  players: Player[];
}

export enum ExtraType {
  Wide = 'wd',
  NoBall = 'nb',
  Byes = 'b',
  LegByes = 'lb',
}

export enum WicketType {
    Bowled = 'bowled',
    Caught = 'caught',
    LBW = 'lbw',
    RunOut = 'run out',
    Stumped = 'stumped',
    HitWicket = 'hit wicket',
    RetiredOut = 'retired out',
    TimedOut = 'timed out',
    ObstructingField = 'obstructing the field',
}

export interface Ball {
  ballNumber: number;
  bowlerId: string;
  batsmanId: string;
  runs: number;
  isWicket: Wicket | null;
  extra: { type: ExtraType; runs: number } | null;
  timestamp: number;
}

export interface Over {
  overNumber: number;
  bowlerId: string;
  balls: Ball[];
  runsScored: number;
}

export interface BatsmanScore {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  wicketInfo?: Wicket;
  status: 'not out' | 'out' | 'did not bat' | 'retired hurt';
}

export interface BowlerScore {
  playerId: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface Wicket {
  playerOutId: string;
  type: WicketType;
  fielderId?: string;
  bowlerId: string;
  over: number;
  ball: number;
  totalScore: number;
}


export interface Innings {
  battingTeamId: string;
  bowlingTeamId: string;
  score: number;
  wickets: number;
  overs: number;
  batsmen: BatsmanScore[];
  bowlers: BowlerScore[];
  fallOfWickets: Wicket[];
  oversHistory: Over[];
  extras: {
    total: number;
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalties: number;
  };
  partnerships: { player1Id: string; player2Id: string; runs: number; balls: number }[];
}

export interface Match {
  id: string;
  teamAId: string;
  teamBId: string;
  overs: number;
  tossWinnerId: string;
  decision: 'bat' | 'bowl';
  status: 'upcoming' | 'live' | 'completed';
  innings1: Innings;
  innings2: Innings | null;
  currentInnings: 1 | 2;
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  target?: number;
  result?: string;
  tournamentId?: string;
  groupId?: string;
}

export interface PointsTableEntry {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  noResult: number;
  points: number;
  netRunRate: number;
}

export interface TournamentGroup {
    id: string;
    name: string;
    teamIds: string[];
}

export interface GroupPointsTable {
    groupId: string;
    entries: PointsTableEntry[];
}

export interface Tournament {
  id: string;
  name: string;
  groups: TournamentGroup[];
  status: 'upcoming' | 'live' | 'completed';
  pointsTables: GroupPointsTable[];
  fixtures: Match[];
}
