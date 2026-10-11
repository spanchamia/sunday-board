export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="stack">
      <h1>{title}</h1>
      <p className="soft">{text}</p>
    </div>
  );
}
