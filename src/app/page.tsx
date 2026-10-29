import { site } from "@/content/site";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{site.name}</h1>
      <p className="max-w-md text-lg">{site.tagline}</p>
    </main>
  );
}
