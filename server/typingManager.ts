/**
 * ============================================================================
 * ⌨️ Real-Time Chat Typing Indicator Manager
 * ============================================================================
 * 
 * Tracks active typers (agents, customers, bot) across omnichannel chat sessions.
 * Manages heartbeats, automatic expirations, and state synchronization.
 */

export interface TypingUser {
  agentId: string;
  name: string;
  role: 'agent' | 'customer' | 'bot';
  avatar?: string;
  dialogId: string;
  lastActive: number;
}

export class TypingManager {
  // Map: dialogId -> Map<agentId, TypingUser>
  private activeTypers = new Map<string, Map<string, TypingUser>>();

  /**
   * Set or clear typing state for a user in a specific dialog
   */
  setTyping(
    dialogId: string,
    user: { agentId: string; name: string; role?: 'agent' | 'customer' | 'bot'; avatar?: string },
    isTyping: boolean
  ): TypingUser[] {
    if (!dialogId) return [];

    let dialogMap = this.activeTypers.get(dialogId);
    if (!dialogMap) {
      dialogMap = new Map();
      this.activeTypers.set(dialogId, dialogMap);
    }

    const userId = user.agentId || user.name;
    if (isTyping) {
      dialogMap.set(userId, {
        agentId: userId,
        name: user.name || 'Оператор',
        role: user.role || 'agent',
        avatar: user.avatar,
        dialogId,
        lastActive: Date.now(),
      });
    } else {
      dialogMap.delete(userId);
      if (dialogMap.size === 0) {
        this.activeTypers.delete(dialogId);
      }
    }

    return this.getTypers(dialogId);
  }

  /**
   * Get list of currently active typers in a dialog, pruning expired entries (> 4.5s)
   */
  getTypers(dialogId: string): TypingUser[] {
    if (!dialogId) return [];
    const dialogMap = this.activeTypers.get(dialogId);
    if (!dialogMap) return [];

    const now = Date.now();
    const active: TypingUser[] = [];
    for (const [userId, typer] of dialogMap.entries()) {
      if (now - typer.lastActive > 4500) {
        dialogMap.delete(userId);
      } else {
        active.push(typer);
      }
    }

    if (dialogMap.size === 0) {
      this.activeTypers.delete(dialogId);
    }

    return active;
  }

  /**
   * Get all active typers mapped by dialogId
   */
  getAllActiveTypers(): Record<string, TypingUser[]> {
    const result: Record<string, TypingUser[]> = {};
    for (const dialogId of Array.from(this.activeTypers.keys())) {
      const typers = this.getTypers(dialogId);
      if (typers.length > 0) {
        result[dialogId] = typers;
      }
    }
    return result;
  }

  /**
   * Clear all typers for a dialog (e.g. when closed or message sent)
   */
  clearDialogTypers(dialogId: string): void {
    this.activeTypers.delete(dialogId);
  }
}

export const typingManager = new TypingManager();
