import type { GameState, UpgradeTrack } from '../types/index.ts';

const SAVE_KEY = 'apache_strait_runner_save';

function createDefaultState(): GameState {
  return {
    credits: 0,
    upgrades: {
      firepower: 0,
      fireRate: 0,
      rockets: 0,
      armor: 0,
    },
    missionResults: {},
    highestUnlockedMission: 0,
    supportUnlocks: {},
    endlessHighScore: 0,
    dailyMissionDate: '',
    dailyMissionCompleted: false,
  };
}

export class SaveManager {
  private state: GameState;

  constructor() {
    this.state = this.load();
  }

  private load(): GameState {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameState>;
        return { ...createDefaultState(), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load save data, starting fresh', e);
    }
    return createDefaultState();
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save game data', e);
    }
  }

  getState(): GameState {
    return this.state;
  }

  getCredits(): number {
    return this.state.credits;
  }

  addCredits(amount: number): void {
    this.state.credits += amount;
    this.save();
  }

  spendCredits(amount: number): boolean {
    if (this.state.credits < amount) return false;
    this.state.credits -= amount;
    this.save();
    return true;
  }

  getUpgradeLevel(track: UpgradeTrack): number {
    return this.state.upgrades[track];
  }

  setUpgradeLevel(track: UpgradeTrack, level: number): void {
    this.state.upgrades[track] = level;
    this.save();
  }

  getHighestUnlockedMission(): number {
    return this.state.highestUnlockedMission;
  }

  unlockNextMission(missionIndex: number): void {
    if (missionIndex >= this.state.highestUnlockedMission) {
      this.state.highestUnlockedMission = missionIndex + 1;
      this.save();
    }
  }

  saveMissionResult(missionId: string, result: { stars: number; time: number; shipsLost: number; shipsSurvived: number; enemiesKilled: number; credits: number }): void {
    const existing = this.state.missionResults[missionId];
    if (!existing || result.stars > existing.stars) {
      this.state.missionResults[missionId] = {
        missionId,
        stars: result.stars,
        bestTime: result.time,
        shipsLost: result.shipsLost,
        shipsSurvived: result.shipsSurvived,
        enemiesKilled: result.enemiesKilled,
        creditsEarned: result.credits,
        completed: true,
      };
    }
    this.save();
  }

  // Support assets
  isSupportUnlocked(type: string): boolean {
    return !!this.state.supportUnlocks[type];
  }

  unlockSupport(type: string): void {
    this.state.supportUnlocks[type] = true;
    this.save();
  }

  // Endless mode
  getEndlessHighScore(): number {
    return this.state.endlessHighScore;
  }

  setEndlessHighScore(score: number): void {
    if (score > this.state.endlessHighScore) {
      this.state.endlessHighScore = score;
      this.save();
    }
  }

  // Daily missions
  getDailyDate(): string {
    return this.state.dailyMissionDate;
  }

  isDailyCompleted(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return this.state.dailyMissionDate === today && this.state.dailyMissionCompleted;
  }

  completeDailyMission(): void {
    this.state.dailyMissionDate = new Date().toISOString().slice(0, 10);
    this.state.dailyMissionCompleted = true;
    this.save();
  }

  resetAll(): void {
    this.state = createDefaultState();
    this.save();
  }
}
