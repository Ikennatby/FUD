import { useEffect, useState } from "react";
import { api, media } from "../lib/api";
import Pic from "./Pic";

// Admin tools for campuses: create one (name + picture), delete one, and move stalls between campuses.
export default function CampusAdmin() {
  const [campuses, setCampuses] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api("/campuses/").then(setCampuses).catch((e) => setError(e.message));
    api("/admin/stalls/").then(setStalls).catch(() => {});
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setMsg("");
    try {
      const fd = new FormData();
      fd.append("name", name);
      if (file) fd.append("picture", file);
      await api("/admin/campuses/", { method: "POST", body: fd });
      setName(""); setFile(null); setFileKey((k) => k + 1);
      setMsg("Campus created. Stalls can now pick it when they sign up.");
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const remove = async (c) => {
    if (!confirm(`Delete ${c.name}? This can't be undone.`)) return;
    setError(""); setMsg("");
    try { await api(`/admin/campuses/${c.id}/`, { method: "DELETE" }); load(); }
    catch (err) { setError(err.message); }
  };
  const changePicture = async (c, f) => {
    if (!f) return;
    setError(""); setMsg("");
    try {
      const fd = new FormData();
      fd.append("picture", f);
      await api(`/admin/campuses/${c.id}/`, { method: "POST", body: fd });
      load();
    } catch (err) { setError(err.message); }
  };
  const moveStall = async (s, campus) => {
    setError(""); setMsg("");
    try {
      const u = await api(`/admin/stalls/${s.id}/`, { method: "POST", body: { campus } });
      setStalls((all) => all.map((x) => (x.id === s.id ? u : x)));
      api("/campuses/").then(setCampuses).catch(() => {});
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <h2>Campuses</h2>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <form className="stall form-grid" onSubmit={create}>
        <input placeholder="Campus name, e.g. University of Port Harcourt" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="muted">Campus profile picture
          <input key={fileKey} type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        <button disabled={!name.trim() || busy}>{busy ? "Creating…" : "Create campus"}</button>
      </form>
      <div className="stall">
        {campuses.length === 0 && <p className="muted">No campuses yet. Create the first one above.</p>}
        {campuses.map((c) => (
          <div key={c.id} className="row item-row">
            <Pic src={media(c.picture)} name={c.name} size={48} />
            <span className="grow">{c.name} <small>{c.stalls} open stall{c.stalls === 1 ? "" : "s"}</small></span>
            <label className="btn ghost-dark file-btn">Change picture
              <input type="file" accept="image/*" hidden onChange={(e) => changePicture(c, e.target.files[0])} />
            </label>
            <button className="danger" onClick={() => remove(c)}>Delete</button>
          </div>
        ))}
      </div>

      <h2>Which campus is each stall on?</h2>
      <div className="stall">
        {stalls.length === 0 && <p className="muted">No stalls yet.</p>}
        {stalls.map((s) => (
          <div key={s.id} className="row">
            <span>{s.name}</span>
            <select value={s.campus || ""} onChange={(e) => moveStall(s, e.target.value)}>
              <option value="" disabled>No campus yet</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>
    </>
  );
}