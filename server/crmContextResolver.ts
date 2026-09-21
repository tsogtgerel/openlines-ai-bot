import fs from 'fs';
import path from 'path';
import {
  crmGetLead,
  crmGetDeal,
  crmUpdateLead,
  crmUpdateDeal,
  crmCreateLead,
  crmCreateDeal,
  crmGetContact,
  crmSearchContacts,
  crmCreateContact,
  crmGetLeadsByContact,
  crmGetDealsByContact,
} from './vibeApi';
import { CustomerProfile, ChatDialog } from './chatManager';

export type CrmState = 'ACTIVE_LEAD' | 'ACTIVE_DEAL' | 'REPEAT_CUSTOMER' | 'UNKNOWN';

export interface CrmContextResolution {
  state: CrmState;
  contactId: number | null;
  contactName: string;
  socialId?: string;
  phone?: string;
  activeLead?: {
    id: number;
    title: string;
    stageId?: string;
    statusId?: string;
    comments?: string;
    assignedById?: number | null;
  } | null;
  activeDeal?: {
    id: number;
    title: string;
    stageId?: string;
    amount?: number;
    assignedById?: number | null;
    dealOwnerName?: string;
    comments?: string;
  } | null;
  isRepeatCustomer: boolean;
  repeatEntityCreated?: {
    type: 'lead' | 'deal';
    id: number;
    title: string;
  } | null;
  assignedCrmId: string;
  toneDirective: string;
  resolutionRuleApplied: string;
  welcomeGreeting?: string;
  resolvedAt: string;
  details: string;
}

export interface StoredContactEntity {
  id: number;
  name: string;
  phone?: string;
  socialId?: string;
  originId?: string;
  email?: string;
  activeLeadId?: number | null;
  activeLead?: {
    id: number;
    title: string;
    stageId?: string;
    statusId?: string;
    comments?: string;
    assignedById?: number | null;
  } | null;
  activeDealId?: number | null;
  activeDeal?: {
    id: number;
    title: string;
    stageId?: string;
    amount?: number;
    assignedById?: number | null;
    dealOwnerName?: string;
    comments?: string;
  } | null;
  closedLeadsCount: number;
  closedDealsCount: number;
  isRepeatCustomer?: boolean;
  lastMessageAttachedAt?: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CRM_STORE_FILE = path.join(DATA_DIR, 'crm_entities.json');

class CrmContextResolverService {
  private contactsCache: Map<string, StoredContactEntity> = new Map(); // key: phone, socialId, or contactId
  private resolvedDialogContexts: Map<string, CrmContextResolution> = new Map();

  constructor() {
    this.loadStore();
  }

  private loadStore() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CRM_STORE_FILE)) {
        const raw = fs.readFileSync(CRM_STORE_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.contacts && Array.isArray(data.contacts)) {
          for (const c of data.contacts) {
            this.indexContact(c);
          }
        }
        if (data.dialogContexts && typeof data.dialogContexts === 'object') {
          for (const [k, v] of Object.entries(data.dialogContexts)) {
            this.resolvedDialogContexts.set(k, v as CrmContextResolution);
          }
        }
      }
    } catch (e: any) {
      console.warn('[CrmContextResolver] Failed to load store:', e.message);
    }
  }

  private saveStore() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const uniqueContacts = Array.from(new Set(this.contactsCache.values()));
      const dialogContextsObj: Record<string, CrmContextResolution> = {};
      for (const [k, v] of this.resolvedDialogContexts.entries()) {
        dialogContextsObj[k] = v;
      }

      fs.writeFileSync(
        CRM_STORE_FILE,
        JSON.stringify(
          {
            version: '1.0',
            updatedAt: new Date().toISOString(),
            contacts: uniqueContacts,
            dialogContexts: dialogContextsObj,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (e: any) {
      console.warn('[CrmContextResolver] Failed to save store:', e.message);
    }
  }

  private indexContact(c: StoredContactEntity) {
    if (c.id) this.contactsCache.set(`id:${c.id}`, c);
    if (c.phone) {
      const cleanPhone = this.cleanPhoneNumber(c.phone);
      if (cleanPhone) this.contactsCache.set(`phone:${cleanPhone}`, c);
    }
    if (c.socialId) this.contactsCache.set(`social:${c.socialId}`, c);
    if (c.originId) this.contactsCache.set(`origin:${c.originId}`, c);
  }

  /**
   * Утасны дугаарыг стандарт 8 оронтой буюу цэвэр хэлбэрт хөрвүүлэх
   */
  public cleanPhoneNumber(phone?: string): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 8) return digits;
    if (digits.length === 11 && digits.startsWith('976')) return digits.slice(3);
    if (digits.length > 8) return digits.slice(-8);
    return digits || undefined;
  }

  /**
   * Текст эсвэл харилцагчийн мэдээллээс Монгол гар утасны дугаар (8 оронтой) шүүж гаргах
   */
  public extractPhone(text?: string, customer?: CustomerProfile): string | undefined {
    if (customer?.phone) {
      const cleaned = this.cleanPhoneNumber(customer.phone);
      if (cleaned) return cleaned;
    }
    if (!text) return undefined;
    const match = text.match(/(?:\+?976)?\s*([89]\d{7}|7\d{7})/);
    if (match && match[1]) {
      return match[1];
    }
    return undefined;
  }

  /**
   * Open Channel сессийн мэдээлэл (userCode, source, customer profile)-аас social ID гаргаж авах
   * Жишээ:
   * facebook|11|2740568092656528|201 -> socialId: 2740568092656528
   * livechat|1|78598|19662 -> socialId: 78598
   * telegram|3|123456789|302 -> socialId: 123456789
   */
  public extractSocialId(params: {
    userCode?: string;
    userId?: number | string;
    customer?: CustomerProfile;
    chatId?: number | string;
  }): string | undefined {
    if (params.userCode && typeof params.userCode === 'string') {
      const parts = params.userCode.split('|');
      if (parts.length >= 3 && parts[2]) {
        return parts[2];
      }
    }
    if (params.customer && (params.customer as any).socialId) {
      return (params.customer as any).socialId;
    }
    if (params.userId && String(params.userId) !== '0') {
      return String(params.userId);
    }
    if (params.chatId) {
      return `chat_user_${params.chatId}`;
    }
    return undefined;
  }

  /**
   * 1. Identify the CRM Contact via social/phone ID
   */
  public async identifyContact(params: {
    phone?: string;
    socialId?: string;
    customerName?: string;
    existingContactId?: number | null;
    channelSource?: string;
  }): Promise<StoredContactEntity> {
    const cleanPhone = this.cleanPhoneNumber(params.phone);
    const socialId = params.socialId;

    // A. Check in-memory / local cache
    if (params.existingContactId && this.contactsCache.has(`id:${params.existingContactId}`)) {
      const cached = this.contactsCache.get(`id:${params.existingContactId}`)!;
      if (cleanPhone && !cached.phone) cached.phone = cleanPhone;
      if (socialId && !cached.socialId) cached.socialId = socialId;
      this.indexContact(cached);
      return cached;
    }

    if (cleanPhone && this.contactsCache.has(`phone:${cleanPhone}`)) {
      const cached = this.contactsCache.get(`phone:${cleanPhone}`)!;
      if (socialId && !cached.socialId) cached.socialId = socialId;
      this.indexContact(cached);
      return cached;
    }

    if (socialId && this.contactsCache.has(`social:${socialId}`)) {
      const cached = this.contactsCache.get(`social:${socialId}`)!;
      if (cleanPhone && !cached.phone) cached.phone = cleanPhone;
      this.indexContact(cached);
      return cached;
    }

    // B. Search via Bitrix24 CRM API by phone
    if (cleanPhone) {
      try {
        const searchRes = await crmSearchContacts({ phone: cleanPhone, limit: 5 });
        if (searchRes.success && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          const bitrixContact = searchRes.data[0];
          const newEntity: StoredContactEntity = {
            id: Number(bitrixContact.id),
            name: bitrixContact.name || params.customerName || 'Харилцагч',
            phone: cleanPhone,
            socialId,
            originId: bitrixContact.originId || undefined,
            email: bitrixContact.email || undefined,
            closedLeadsCount: 0,
            closedDealsCount: 0,
            updatedAt: new Date().toISOString(),
          };
          this.indexContact(newEntity);
          this.saveStore();
          return newEntity;
        }
      } catch (err: any) {
        console.warn('[CrmContextResolver] Bitrix contact search error:', err.message);
      }
    }

    // C. Check if direct contact ID exists in Bitrix
    if (params.existingContactId) {
      try {
        const directContact = await crmGetContact(params.existingContactId);
        if (directContact.success && directContact.data) {
          const c = directContact.data;
          const newEntity: StoredContactEntity = {
            id: Number(c.id),
            name: c.name || params.customerName || 'Харилцагч',
            phone: cleanPhone || c.phone,
            socialId,
            originId: c.originId || undefined,
            email: c.email || undefined,
            closedLeadsCount: 0,
            closedDealsCount: 0,
            updatedAt: new Date().toISOString(),
          };
          this.indexContact(newEntity);
          this.saveStore();
          return newEntity;
        }
      } catch (e: any) {
        console.warn('[CrmContextResolver] Direct contact fetch error:', e.message);
      }
    }

    // D. If not found in Bitrix, create or register new CRM contact
    const generatedId = params.existingContactId || (cleanPhone ? Number(cleanPhone) : Math.floor(100000 + Math.random() * 900000));
    const contactName = params.customerName || 'Харилцагч';

    // Attempt to register in Bitrix CRM
    let bitrixId = generatedId;
    try {
      const createRes = await crmCreateContact({
        name: contactName,
        phone: cleanPhone,
        comments: `Registered from Open Channel (${params.channelSource || 'openlines'}, SocialID: ${socialId || 'N/A'})`,
        sourceId: (params.channelSource || 'OPENLINES').toUpperCase(),
        originId: socialId,
      });
      if (createRes.success && createRes.data?.id) {
        bitrixId = Number(createRes.data.id);
      }
    } catch {}

    const registeredEntity: StoredContactEntity = {
      id: bitrixId,
      name: contactName,
      phone: cleanPhone,
      socialId,
      originId: socialId,
      closedLeadsCount: 0,
      closedDealsCount: 0,
      updatedAt: new Date().toISOString(),
    };

    this.indexContact(registeredEntity);
    this.saveStore();
    return registeredEntity;
  }

  /**
   * Helper to format appended message notes onto Lead / Deal comments
   */
  private appendComment(existingComments: string | undefined, newComment: string): string {
    const timestamp = new Date().toLocaleString('mn-MN', { hour12: false });
    const line = `[${timestamp} Харилцагчийн мессеж]: ${newComment}`;
    if (!existingComments) return line;
    return `${existingComments}\n\n${line}`;
  }

  /**
   * Helper to check if a Lead is in ACTIVE (unclosed) state
   */
  public isLeadActive(lead: any): boolean {
    if (!lead) return false;
    if (lead.isConvert === true) return false;
    if (lead.dateClosed) return false;
    const stage = String(lead.stageId || lead.statusId || '').toUpperCase();
    if (stage === 'CONVERTED' || stage === 'JUNK' || stage === 'CLOSED') return false;
    // Bitrix stageSemanticId: 'S' (success/converted), 'F' (failed/junk), 'P' (process/active)
    if (lead.stageSemanticId === 'S' || lead.stageSemanticId === 'F') return false;
    return true;
  }

  /**
   * Helper to check if a Deal is in ACTIVE (unclosed) state
   */
  public isDealActive(deal: any): boolean {
    if (!deal) return false;
    if (deal.closed === true || deal.closedAt) return false;
    const stage = String(deal.stageId || '').toUpperCase();
    if (stage.includes('WON') || stage.includes('LOSE') || stage === 'CLOSED') return false;
    if (deal.stageSemanticId === 'S' || deal.stageSemanticId === 'F') return false;
    return true;
  }

  /**
   * [SESSION CONTEXT RESOLUTION RULE]
   * When a message arrives from an Open Channel session:
   * 1. Identify the CRM Contact via social/phone ID.
   * 2. Query the Contact's CRM State:
   *    - IF Active_Lead == TRUE:
   *        Attach message to Active Lead. Do NOT create a new Lead.
   *        Tone: Continue previous qualification.
   *    - IF Active_Deal == TRUE:
   *        Attach message to Active Deal. Do NOT create new Deal/Lead.
   *        Tone: Assist with ongoing order status or forward to Deal owner.
   *    - IF (All Leads/Deals are CLOSED) OR No active entity:
   *        Treat as REPEAT customer.
   *        Create "Repeat Lead" (in Classic CRM) or "Repeat Deal" (in Simple CRM).
   *        Do NOT ask basic identity questions. Acknowledge return: "Welcome back! How can we assist you today?"
   */
  public async resolveSessionContext(params: {
    dialogId: string;
    chatId?: number;
    userCode?: string;
    customer?: CustomerProfile;
    messageText: string;
    channelSource?: string;
    crmMode?: 'classic' | 'simple';
    existingCrmEntity?: { type?: string; id?: number };
  }): Promise<CrmContextResolution> {
    const crmMode = params.crmMode || 'classic';
    const messageText = (params.messageText || '').trim();
    const customerName = params.customer?.name || 'Харилцагч';

    // 1. Identify the CRM Contact via social/phone ID
    const extractedPhone = this.extractPhone(messageText, params.customer);
    const extractedSocialId = this.extractSocialId({
      userCode: params.userCode,
      customer: params.customer,
      chatId: params.chatId,
    });

    let existingContactId: number | null = null;
    if (params.customer && (params.customer as any).contactId) {
      existingContactId = Number((params.customer as any).contactId);
    }

    // Also inspect if existing session was tied to a lead or deal in Bitrix
    let sessionLead: any = null;
    let sessionDeal: any = null;
    const existingCrmIdStr = params.customer?.crmLeadId;

    if (existingCrmIdStr && existingCrmIdStr.includes('-')) {
      const [type, idStr] = existingCrmIdStr.split('-');
      const numId = Number(idStr);
      if (!isNaN(numId) && numId > 0) {
        if (type.toUpperCase() === 'LEAD') {
          try {
            const lRes = await crmGetLead(numId);
            if (lRes.success && lRes.data) {
              sessionLead = lRes.data;
              if (sessionLead.contactId) existingContactId = Number(sessionLead.contactId);
            }
          } catch {}
        } else if (type.toUpperCase() === 'DEAL') {
          try {
            const dRes = await crmGetDeal(numId);
            if (dRes.success && dRes.data) {
              sessionDeal = dRes.data;
              if (sessionDeal.contactId) existingContactId = Number(sessionDeal.contactId);
            }
          } catch {}
        }
      }
    }

    const contact = await this.identifyContact({
      phone: extractedPhone,
      socialId: extractedSocialId,
      customerName,
      existingContactId,
      channelSource: params.channelSource,
    });

    const contactId = contact.id;

    // 2. Query the Contact's CRM State
    let leads: any[] = [];
    let deals: any[] = [];

    if (contactId) {
      try {
        const [lRes, dRes] = await Promise.all([
          crmGetLeadsByContact(contactId).catch(() => ({ success: false, data: [] })),
          crmGetDealsByContact(contactId).catch(() => ({ success: false, data: [] })),
        ]);
        if (lRes.success && Array.isArray(lRes.data)) leads = lRes.data;
        if (dRes.success && Array.isArray(dRes.data)) deals = dRes.data;
      } catch (err: any) {
        console.warn('[CrmContextResolver] Failed to query leads/deals for contact:', err.message);
      }
    }

    // Incorporate session entities if verified
    if (sessionLead && !leads.some((l) => l.id === sessionLead.id)) leads.unshift(sessionLead);
    if (sessionDeal && !deals.some((d) => d.id === sessionDeal.id)) deals.unshift(sessionDeal);

    // Check cached active entities for this contact
    if (contact.activeLead && !leads.some((l) => l.id === contact.activeLead?.id)) {
      leads.unshift(contact.activeLead);
    } else if (contact.activeLeadId && !leads.some((l) => l.id === contact.activeLeadId)) {
      try {
        const lRes = await crmGetLead(contact.activeLeadId);
        if (lRes.success && lRes.data) {
          leads.unshift(lRes.data);
        } else {
          leads.unshift({ id: contact.activeLeadId, title: `Active Lead #${contact.activeLeadId}`, statusId: 'IN_PROCESS' });
        }
      } catch {
        leads.unshift({ id: contact.activeLeadId, title: `Active Lead #${contact.activeLeadId}`, statusId: 'IN_PROCESS' });
      }
    }

    if (contact.activeDeal && !deals.some((d) => d.id === contact.activeDeal?.id)) {
      deals.unshift(contact.activeDeal);
    } else if (contact.activeDealId && !deals.some((d) => d.id === contact.activeDealId)) {
      try {
        const dRes = await crmGetDeal(contact.activeDealId);
        if (dRes.success && dRes.data) {
          deals.unshift(dRes.data);
        } else {
          deals.unshift({ id: contact.activeDealId, title: `Active Deal #${contact.activeDealId}`, stageId: 'EXECUTING' });
        }
      } catch {
        deals.unshift({ id: contact.activeDealId, title: `Active Deal #${contact.activeDealId}`, stageId: 'EXECUTING' });
      }
    }

    // Determine Active Lead
    const activeLead = leads.find((l) => this.isLeadActive(l));
    const hasActiveLead = Boolean(activeLead);

    // Determine Active Deal
    const activeDeal = deals.find((d) => this.isDealActive(d));
    const hasActiveDeal = Boolean(activeDeal);

    // Count closed entities
    const closedLeads = leads.filter((l) => !this.isLeadActive(l));
    const closedDeals = deals.filter((d) => !this.isDealActive(d));
    const totalEntities = leads.length + deals.length;
    const allEntitiesClosed = totalEntities > 0 && !hasActiveLead && !hasActiveDeal;
    const noActiveEntity = !hasActiveLead && !hasActiveDeal;

    const nowIso = new Date().toISOString();

    // -----------------------------------------------------------------------
    // RULE BRANCH 1: IF Active_Lead == TRUE
    // Attach message to Active Lead. Do NOT create a new Lead.
    // Tone: Continue previous qualification.
    // -----------------------------------------------------------------------
    if (hasActiveLead && activeLead) {
      console.log(`[CrmContextResolver] Rule MATCH: Active_Lead == TRUE (#LEAD-${activeLead.id}). Attaching message, suppressing new lead creation.`);

      // Attach message to Active Lead
      if (messageText) {
        const updatedComments = this.appendComment(activeLead.comments, messageText);
        crmUpdateLead(activeLead.id, { comments: updatedComments }).catch((err) =>
          console.warn(`[CrmContextResolver] Failed to attach message to Lead #${activeLead.id}:`, err.message)
        );
      }

      contact.activeLeadId = activeLead.id;
      contact.lastMessageAttachedAt = nowIso;
      contact.updatedAt = nowIso;
      this.saveStore();

      const resolution: CrmContextResolution = {
        state: 'ACTIVE_LEAD',
        contactId,
        contactName: contact.name,
        socialId: extractedSocialId,
        phone: contact.phone || extractedPhone,
        activeLead: {
          id: activeLead.id,
          title: activeLead.title || `Lead #${activeLead.id}`,
          stageId: activeLead.stageId || activeLead.statusId,
          statusId: activeLead.statusId || activeLead.stageId,
          comments: activeLead.comments,
          assignedById: activeLead.assignedById,
        },
        activeDeal: null,
        isRepeatCustomer: false,
        repeatEntityCreated: null,
        assignedCrmId: `LEAD-${activeLead.id}`,
        toneDirective: 'Continue previous qualification',
        resolutionRuleApplied: 'Attach message to Active Lead. Do NOT create a new Lead. Tone: Continue previous qualification.',
        resolvedAt: nowIso,
        details: `Харилцагч идэвхтэй Lead-тэй (#LEAD-${activeLead.id}) байгаа тул мессежийг шууд хавсаргаж, өмнөх тодруулга, мэргэшүүлэлтийг (qualification) хэвийн үргэлжлүүлнэ. Шинэ Lead үүсгээгүй.`,
      };

      this.resolvedDialogContexts.set(params.dialogId, resolution);
      this.saveStore();
      return resolution;
    }

    // -----------------------------------------------------------------------
    // RULE BRANCH 2: IF Active_Deal == TRUE
    // Attach message to Active Deal. Do NOT create new Deal/Lead.
    // Tone: Assist with ongoing order status or forward to Deal owner.
    // -----------------------------------------------------------------------
    if (hasActiveDeal && activeDeal) {
      console.log(`[CrmContextResolver] Rule MATCH: Active_Deal == TRUE (#DEAL-${activeDeal.id}). Attaching message, suppressing new deal/lead creation.`);

      // Attach message to Active Deal
      if (messageText) {
        const updatedComments = this.appendComment(activeDeal.comments, messageText);
        crmUpdateDeal(activeDeal.id, { comments: updatedComments }).catch((err) =>
          console.warn(`[CrmContextResolver] Failed to attach message to Deal #${activeDeal.id}:`, err.message)
        );
      }

      contact.activeDealId = activeDeal.id;
      contact.lastMessageAttachedAt = nowIso;
      contact.updatedAt = nowIso;
      this.saveStore();

      const resolution: CrmContextResolution = {
        state: 'ACTIVE_DEAL',
        contactId,
        contactName: contact.name,
        socialId: extractedSocialId,
        phone: contact.phone || extractedPhone,
        activeLead: null,
        activeDeal: {
          id: activeDeal.id,
          title: activeDeal.title || `Захиалга #${activeDeal.id}`,
          stageId: activeDeal.stageId,
          amount: activeDeal.amount,
          assignedById: activeDeal.assignedById,
          dealOwnerName: activeDeal.assignedById ? `Менежер #${activeDeal.assignedById}` : 'Хариуцсан менежер',
          comments: activeDeal.comments,
        },
        isRepeatCustomer: false,
        repeatEntityCreated: null,
        assignedCrmId: `DEAL-${activeDeal.id}`,
        toneDirective: 'Assist with ongoing order status or forward to Deal owner',
        resolutionRuleApplied: 'Attach message to Active Deal. Do NOT create new Deal/Lead. Tone: Assist with ongoing order status or forward to Deal owner.',
        resolvedAt: nowIso,
        details: `Харилцагч идэвхтэй захиалгатай (#DEAL-${activeDeal.id}) байгаа тул мессежийг Active Deal-д хавсаргав. Захиалгын явцаар туслах эсвэл хариуцсан менежерт холбох өнгө аяс баримтална. Шинэ Deal/Lead үүсгээгүй.`,
      };

      this.resolvedDialogContexts.set(params.dialogId, resolution);
      this.saveStore();
      return resolution;
    }

    // -----------------------------------------------------------------------
    // RULE BRANCH 3: IF (All Leads/Deals are CLOSED) OR No active entity
    // Treat as REPEAT customer.
    // Create "Repeat Lead" (in Classic CRM) or "Repeat Deal" (in Simple CRM).
    // Do NOT ask basic identity questions. Acknowledge return: "Welcome back! How can we assist you today?"
    // -----------------------------------------------------------------------
    console.log(`[CrmContextResolver] Rule MATCH: All Leads/Deals are CLOSED (${allEntitiesClosed}) or No active entity (${noActiveEntity}). Treating as REPEAT customer.`);

    contact.isRepeatCustomer = true;
    contact.closedLeadsCount = closedLeads.length;
    contact.closedDealsCount = closedDeals.length;
    contact.activeLeadId = null;
    contact.activeDealId = null;
    contact.updatedAt = nowIso;

    let repeatEntity: { type: 'lead' | 'deal'; id: number; title: string } | null = null;
    let finalCrmId = `REPEAT-${Date.now().toString().slice(-4)}`;

    if (crmMode === 'classic') {
      const repeatLeadTitle = `Repeat Lead: ${contact.name}`;
      try {
        const leadRes = await crmCreateLead({
          title: repeatLeadTitle,
          name: contact.name,
          phone: contact.phone || extractedPhone,
          contactId,
          comments: `[REPEAT CUSTOMER] Харилцагчийн хүсэлт: ${messageText}`,
          isReturnCustomer: true,
          statusId: 'NEW',
        });
        if (leadRes.success && leadRes.data?.id) {
          repeatEntity = {
            type: 'lead',
            id: Number(leadRes.data.id),
            title: repeatLeadTitle,
          };
          finalCrmId = `LEAD-${repeatEntity.id}`;
          contact.activeLeadId = repeatEntity.id;
        } else {
          // Fallback simulation lead ID
          const fallbackId = Math.floor(60000 + Math.random() * 9000);
          repeatEntity = {
            type: 'lead',
            id: fallbackId,
            title: repeatLeadTitle,
          };
          finalCrmId = `LEAD-${fallbackId}`;
          contact.activeLeadId = fallbackId;
        }
      } catch (err: any) {
        const fallbackId = Math.floor(60000 + Math.random() * 9000);
        repeatEntity = {
          type: 'lead',
          id: fallbackId,
          title: repeatLeadTitle,
        };
        finalCrmId = `LEAD-${fallbackId}`;
        contact.activeLeadId = fallbackId;
      }
    } else {
      // Simple CRM mode: creates "Repeat Deal"
      const repeatDealTitle = `Repeat Deal: ${contact.name}`;
      try {
        const dealRes = await crmCreateDeal({
          title: repeatDealTitle,
          contactId,
          stageId: 'NEW',
          comments: `[REPEAT CUSTOMER] Харилцагчийн хүсэлт: ${messageText}`,
        });
        if (dealRes.success && dealRes.data?.id) {
          repeatEntity = {
            type: 'deal',
            id: Number(dealRes.data.id),
            title: repeatDealTitle,
          };
          finalCrmId = `DEAL-${repeatEntity.id}`;
          contact.activeDealId = repeatEntity.id;
        } else {
          const fallbackId = Math.floor(4000 + Math.random() * 900);
          repeatEntity = {
            type: 'deal',
            id: fallbackId,
            title: repeatDealTitle,
          };
          finalCrmId = `DEAL-${fallbackId}`;
          contact.activeDealId = fallbackId;
        }
      } catch (err: any) {
        const fallbackId = Math.floor(4000 + Math.random() * 900);
        repeatEntity = {
          type: 'deal',
          id: fallbackId,
          title: repeatDealTitle,
        };
        finalCrmId = `DEAL-${fallbackId}`;
        contact.activeDealId = fallbackId;
      }
    }

    this.saveStore();

    const resolution: CrmContextResolution = {
      state: 'REPEAT_CUSTOMER',
      contactId,
      contactName: contact.name,
      socialId: extractedSocialId,
      phone: contact.phone || extractedPhone,
      activeLead: null,
      activeDeal: null,
      isRepeatCustomer: true,
      repeatEntityCreated: repeatEntity,
      assignedCrmId: finalCrmId,
      toneDirective: 'Do NOT ask basic identity questions. Acknowledge return: "Welcome back! How can we assist you today?"',
      resolutionRuleApplied:
        crmMode === 'classic'
          ? 'Treat as REPEAT customer. Create "Repeat Lead" (in Classic CRM). Do NOT ask basic identity questions. Acknowledge return: "Welcome back! How can we assist you today?"'
          : 'Treat as REPEAT customer. Create "Repeat Deal" (in Simple CRM). Do NOT ask basic identity questions. Acknowledge return: "Welcome back! How can we assist you today?"',
      welcomeGreeting: 'Тавтай морилно уу! Танд өнөөдөр хэрхэн туслах вэ?',
      resolvedAt: nowIso,
      details: `Бүх өмнөх Lead/Deal хаагдсан эсвэл идэвхтэй бичиглэлгүй тул ДАВТАН ХАРИЛЦАГЧААР тооцов. ${
        crmMode === 'classic' ? 'Repeat Lead' : 'Repeat Deal'
      } үүсгэгдсэн (#${repeatEntity?.id}). Харилцагчаас нэр, утас гэх мэт анхан шатны мэдээллийг асуухгүй, 'Тавтай морилно уу! Танд өнөөдөр хэрхэн туслах вэ?' гэж угтана.`,
    };

    this.resolvedDialogContexts.set(params.dialogId, resolution);
    this.saveStore();
    return resolution;
  }

  /**
   * Get previously resolved CRM context for a dialog if present
   */
  public getDialogContext(dialogId: string): CrmContextResolution | undefined {
    return this.resolvedDialogContexts.get(dialogId);
  }

  public getCachedContext(dialogId: string): CrmContextResolution | undefined {
    return this.getDialogContext(dialogId);
  }

  /**
   * Manually record or override CRM state for testing / demo
   */
  public setMockContactState(contactId: number, state: { activeLeadId?: number | null; activeDealId?: number | null }) {
    const contact = this.contactsCache.get(`id:${contactId}`);
    if (contact) {
      if (state.activeLeadId !== undefined) contact.activeLeadId = state.activeLeadId;
      if (state.activeDealId !== undefined) contact.activeDealId = state.activeDealId;
      contact.updatedAt = new Date().toISOString();
      this.saveStore();
    }
  }

  /**
   * Return all stored contacts for diagnostics / CRM status view
   */
  public getAllContacts(): StoredContactEntity[] {
    return Array.from(new Set(this.contactsCache.values()));
  }

  public getAllStoredContacts(): StoredContactEntity[] {
    return this.getAllContacts();
  }

  public updateStoredContact(contact: StoredContactEntity) {
    this.indexContact(contact);
    this.saveStore();
  }
}

export const crmContextResolver = new CrmContextResolverService();
