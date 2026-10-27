import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/contact")({ head: () => ({ meta: [
  { title: "Contact Us — Tryumph Gym" },
  { name: "description", content: "Contact Tryumph Gym about support, billing, trainer accounts, safety or privacy." },
] }), component: Contact });
const address = import.meta.env.VITE_CONTACT_EMAIL?.trim() || "";
function Contact() {
  const [topic,setTopic]=useState("General question");
  const [message,setMessage]=useState("");
  const [replyTo,setReplyTo]=useState("");
  const canSend=Boolean(address && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
  const submit=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if (!canSend || !message.trim() || !replyTo.trim()) return;
    const subject=`Tryumph Gym: ${topic}`;
    const body=`Reply to: ${replyTo.trim()}\n\n${message.trim()}`;
    window.location.href=`mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return <div className="mx-auto max-w-2xl space-y-6">
    <header><p className="eyebrow">We're here to help</p><h1 className="mt-2 text-3xl font-extrabold">Contact Us</h1><p className="mt-2 text-muted-foreground">Questions about Tryumph Gym, trainer onboarding, classes, payments, safety or privacy? Reach our team here.</p></header>
    <section className="card space-y-3 p-6">
      <h2 className="text-xl font-bold">Contact the Tryumph team</h2>
      {canSend ? <><p className="text-sm">Email <a className="text-primary underline" href={`mailto:${address}`}>{address}</a>, or prepare a message below.</p>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm font-medium">Your email<input className="field mt-1" type="email" autoComplete="email" value={replyTo} onChange={e=>setReplyTo(e.target.value)} required /></label>
          <label className="block text-sm font-medium">Reason for contacting us<select className="field mt-1" value={topic} onChange={e=>setTopic(e.target.value)}>
            {["General question","Trainer onboarding","Bookings or payments","Report safety or abuse","Privacy or data request","Accessibility","Advertising or partnerships"].map(x=><option key={x}>{x}</option>)}
          </select></label>
          <label className="block text-sm font-medium">Message<textarea className="field mt-1 min-h-32" maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)} required /></label>
          <button className="btn btn-primary" type="submit">Open email to send</button>
          <p className="text-xs text-muted-foreground">This opens your email application. Your request isn't submitted until you send the email. Please don't include passwords, payment-card numbers or sensitive medical records.</p>
        </form></> : <div role="status" className="rounded-lg border p-4 text-sm">Our support email channel is being finalized. This page needs a verified support address configured before launch. If you are already in contact with our team, please use your existing conversation.</div>}
    </section>
    <section className="card space-y-2 p-6"><h2 className="font-semibold">Helpful links</h2><p className="text-sm"><Link className="text-primary underline" to="/terms">Terms and booking policies</Link> · <Link className="text-primary underline" to="/privacy">Privacy and data requests</Link></p><p className="text-sm text-muted-foreground">If there is immediate danger or a medical emergency, contact local emergency services rather than this form.</p></section>
  </div>;
}
