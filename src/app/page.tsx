import { DraftRibbon } from "@/components/draft-ribbon";
import { content } from "@/content";

export default function Home() {
  const { site } = content;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <DraftRibbon uses={[site]} />
      <h1 className="text-4xl font-semibold tracking-tight">{site.name}</h1>
      <p className="max-w-md text-lg">{site.description.text}</p>
    </div>
  );
}
