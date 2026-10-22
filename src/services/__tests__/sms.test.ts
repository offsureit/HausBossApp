import { conversationTitle, matchesConversation } from '~/services/sms';
import type { SmsConversation } from '@/types';

const base: SmsConversation = {
  id: 'c1', company_id: 'co', customer_id: 'cu', customer_phone: '+15125550123', active_job_id: null, assigned_user_id: null, status: 'open', unread_count: 0,
  last_message_at: null, last_message_preview: 'Running late, be there at 3', last_direction: 'inbound', created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:00:00Z',
  customer_name: 'Maria Lopez', assigned_name: null, job_client_name: 'Maria Lopez', job_status: null, sms_opted_out: false,
};

describe('sms service helpers', () => {
  it('titles a thread by the customer name, else the formatted number', () => {
    expect(conversationTitle(base)).toBe('Maria Lopez');
    expect(conversationTitle({ customer_name: null, customer_phone: '+15125550123' })).toBe('(512) 555-0123');
    expect(conversationTitle({ customer_name: '  ', customer_phone: '+4420123' })).toBe('+4420123');
  });

  it('matches by name, job, phone digits (3+) or the last message', () => {
    expect(matchesConversation(base, '')).toBe(true);
    expect(matchesConversation(base, 'maria')).toBe(true);
    expect(matchesConversation(base, '555')).toBe(true);
    expect(matchesConversation(base, '55')).toBe(false);
    expect(matchesConversation(base, 'late')).toBe(true);
    expect(matchesConversation(base, 'nobody')).toBe(false);
  });
});
