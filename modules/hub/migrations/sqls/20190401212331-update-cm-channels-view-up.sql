CREATE OR REPLACE VIEW cm_channels AS
  SELECT _cm_channels.id,
         _cm_channels.contract,
         _cm_channels.hub,
         _cm_channels."user",
         _cm_channels.status,
         _cm_channels.hub_signed_on,
         _cm_channels.user_signed_on,
         _cm_channels.reason,
         _cm_channels.args,
         _cm_channels.recipient,
         _cm_channels.balance_wei_hub,
         _cm_channels.balance_wei_user,
         _cm_channels.balance_token_hub,
         _cm_channels.balance_token_user,
         _cm_channels.pending_deposit_wei_hub,
         _cm_channels.pending_deposit_wei_user,
         _cm_channels.pending_deposit_token_hub,
         _cm_channels.pending_deposit_token_user,
         _cm_channels.pending_withdrawal_wei_hub,
         _cm_channels.pending_withdrawal_wei_user,
         _cm_channels.pending_withdrawal_token_hub,
         _cm_channels.pending_withdrawal_token_user,
         _cm_channels.tx_count_global,
         _cm_channels.tx_count_chain,
         _cm_channels.thread_root,
         _cm_channels.thread_count,
         _cm_channels.timeout,
         _cm_channels.sig_hub,
         _cm_channels.sig_user,
         _cm_channels.latest_update_id,
         _cm_channels.last_updated_on,
         _cm_channels.channel_dispute_event_id,
         _cm_channels.channel_dispute_ends_on,
         _cm_channels.channel_dispute_originator,
         _cm_channels.thread_dispute_event_id,
         _cm_channels.thread_dispute_ends_on,
         _cm_channels.thread_dispute_originator,
         _cm_channels.channel_dispute_id
  FROM _cm_channels;