/**
 * liveBroadcast — real live-video infrastructure for the Live feature.
 *
 * The host's camera+mic streams to each viewer over WebRTC; SDP offers/answers
 * and ICE candidates are signalled over the SAME Supabase Realtime channel the
 * room already uses (no media server, no third-party service). This is a P2P
 * mesh: the host opens one RTCPeerConnection per viewer and sends their tracks.
 * Good for intimate lives; swap in an SFU (LiveKit/Agora) later for big-room scale
 * — the signalling contract here is the same shape an SFU would consume.
 *
 * Signalling events (broadcast on `live-<roomId>`):
 *   rtc-join   { viewerId }                  viewer announces itself
 *   rtc-offer  { to, from, sdp }             host → a specific viewer
 *   rtc-answer { to, from, sdp }             viewer → host
 *   rtc-ice    { to, from, candidate }       either direction, targeted
 */

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

type Send = (event: string, payload: Record<string, unknown>) => void;

export interface LiveRTCOpts {
  isHost: boolean;
  selfId: string;
  send: Send;
  /** Host: the live camera/mic stream (may arrive after viewers join). */
  getLocalStream?: () => MediaStream | null;
  /** Viewer: called when the host's remote stream arrives. */
  onRemoteStream?: (stream: MediaStream) => void;
  /** Optional: connection-state surface for UI ("connecting"/"live"). */
  onState?: (state: RTCPeerConnectionState) => void;
}

/**
 * Owns the peer connections for one participant (host OR viewer) and is driven by
 * the room channel's broadcast events. Create one per room; call destroy() on exit.
 */
export class LiveRTC {
  private pcs = new Map<string, RTCPeerConnection>();
  /** Host: viewers that joined before the local stream was ready. */
  private pending = new Set<string>();
  private dead = false;

  constructor(private o: LiveRTCOpts) {}

  /** Viewer: announce so the host opens a connection to us. Call after SUBSCRIBED. */
  announce() {
    if (this.o.isHost || this.dead) return;
    this.o.send('rtc-join', { viewerId: this.o.selfId });
  }

  /** Host: a viewer announced. Offer them our tracks (or queue until stream ready). */
  async onJoin(viewerId: string) {
    if (!this.o.isHost || this.dead || viewerId === this.o.selfId) return;
    const stream = this.o.getLocalStream?.();
    if (!stream) { this.pending.add(viewerId); return; }
    await this.offer(viewerId, stream);
  }

  /** Host: the local stream is ready — offer any viewers that were waiting. */
  async flushPending() {
    if (!this.o.isHost) return;
    const stream = this.o.getLocalStream?.();
    if (!stream) return;
    const waiting = [...this.pending];
    this.pending.clear();
    for (const v of waiting) await this.offer(v, stream);
  }

  private async offer(viewerId: string, stream: MediaStream) {
    const pc = this.makePc(viewerId);
    stream.getTracks().forEach((t) => { try { pc.addTrack(t, stream); } catch { /* already added */ } });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.o.send('rtc-offer', { to: viewerId, from: this.o.selfId, sdp: offer });
  }

  /** Viewer: host offered. Answer + surface the incoming stream. */
  async onOffer(from: string, sdp: RTCSessionDescriptionInit) {
    if (this.o.isHost || this.dead) return;
    const pc = this.makePc(from);
    pc.ontrack = (e) => { if (e.streams[0]) this.o.onRemoteStream?.(e.streams[0]); };
    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.o.send('rtc-answer', { to: from, from: this.o.selfId, sdp: answer });
  }

  /** Host: viewer answered. */
  async onAnswer(from: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.pcs.get(from);
    if (pc && !pc.currentRemoteDescription) { try { await pc.setRemoteDescription(sdp); } catch { /* stale */ } }
  }

  async onIce(from: string, candidate: RTCIceCandidateInit) {
    const pc = this.pcs.get(from);
    if (pc && candidate) { try { await pc.addIceCandidate(candidate); } catch { /* race / already connected */ } }
  }

  private makePc(peerId: string): RTCPeerConnection {
    const existing = this.pcs.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (e) => { if (e.candidate) this.o.send('rtc-ice', { to: peerId, from: this.o.selfId, candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      this.o.onState?.(pc.connectionState);
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { try { pc.close(); } catch { /* noop */ } this.pcs.delete(peerId); }
    };
    this.pcs.set(peerId, pc);
    return pc;
  }

  destroy() {
    this.dead = true;
    this.pcs.forEach((pc) => { try { pc.close(); } catch { /* noop */ } });
    this.pcs.clear();
    this.pending.clear();
  }
}
