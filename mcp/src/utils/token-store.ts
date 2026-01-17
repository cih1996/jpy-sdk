
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const DATA_DIR = path.join(os.homedir(), 'jpy-data');

export interface SessionData {
    token: string;
    username: string;
    password?: string; // Stored for auto-login
    address: string;
    proxy?: string; // Optional proxy address for tunneling
    updatedAt: string;
}

export class TokenStore {
    
    private getHash(text: string): string {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    private getFilePath(userId: string, address: string, type: 'cache' | 'error' | 'snapshot' = 'cache'): string {
        const addrHash = this.getHash(address);
        let subDir = 'cache-server';
        if (type === 'error') subDir = 'error-server';
        if (type === 'snapshot') subDir = 'snapshot-server';
        
        return path.join(DATA_DIR, userId, subDir, `${addrHash}.json`);
    }

    public saveSession(userId: string, address: string, data: SessionData) {
        const filePath = this.getFilePath(userId, address, 'cache');
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    public saveError(userId: string, address: string, data: any) {
        const filePath = this.getFilePath(userId, address, 'error');
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }



    public saveSnapshot(userId: string, address: string, data: any) {
        const filePath = this.getFilePath(userId, address, 'snapshot');
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    public loadSession(userId: string, address: string): SessionData | null {
        const filePath = this.getFilePath(userId, address, 'cache');
        
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(content) as SessionData;
            } catch (e) {
                console.error(`Failed to load session for ${userId}@${address}`, e);
            }
        }
        return null;
    }

    public getAllSessions(userId: string): SessionData[] {
        const cacheDir = path.join(DATA_DIR, userId, 'cache-server');
        const sessions: SessionData[] = [];

        if (fs.existsSync(cacheDir)) {
             try {
                const files = fs.readdirSync(cacheDir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                         const sessionPath = path.join(cacheDir, file);
                         try {
                            const content = fs.readFileSync(sessionPath, 'utf-8');
                            const data = JSON.parse(content) as SessionData;
                            sessions.push(data);
                        } catch (e) {
                            // Ignore malformed session files
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to list sessions from cache-server for ${userId}`, e);
            }
        }

        return sessions;
    }
    
    public getAllErrors(userId: string): any[] {
        const errorDir = path.join(DATA_DIR, userId, 'error-server');
        const errors: any[] = [];

        if (fs.existsSync(errorDir)) {
             try {
                const files = fs.readdirSync(errorDir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                         const errorPath = path.join(errorDir, file);
                         try {
                            const content = fs.readFileSync(errorPath, 'utf-8');
                            const data = JSON.parse(content);
                            errors.push(data);
                        } catch (e) {
                            // Ignore malformed error files
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to list errors from error-server for ${userId}`, e);
            }
        }
        return errors;
    }
    


    public getAllSnapshots(userId: string): any[] {
        const snapshotDir = path.join(DATA_DIR, userId, 'snapshot-server');
        const snapshots: any[] = [];

        if (fs.existsSync(snapshotDir)) {
             try {
                const files = fs.readdirSync(snapshotDir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                         const snapPath = path.join(snapshotDir, file);
                         try {
                            const content = fs.readFileSync(snapPath, 'utf-8');
                            const data = JSON.parse(content);
                            snapshots.push(data);
                        } catch (e) {
                            // Ignore malformed files
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to list snapshots from snapshot-server for ${userId}`, e);
            }
        }

        return snapshots;
    }

    public clearErrors(userId: string) {
        const errorDir = path.join(DATA_DIR, userId, 'error-server');
        if (fs.existsSync(errorDir)) {
             fs.rmSync(errorDir, { recursive: true, force: true });
        }
    }
}

export const tokenStore = new TokenStore();
