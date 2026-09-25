import { Nav } from './Nav';
import { Preloader, IntroHint, Manifesto, WorkPanel, LabLabel, LanternSkyLabel, FinaleSky, ActCard, EndCap, Contact, WebGLLost, NotFound } from './Sections';
import { useStore } from './useStore';
import { ChapterView } from '../birthday/ui/ChapterView';
import { CursorTrail } from './CursorTrail';
import '../birthday/ui/birthday.css';

export function App() {
  const revealed = useStore((s) => s.revealed);
  return (
    <>
      <Preloader />
      {revealed && (
        <>
          <a className="sr-only sr-only-focusable" href="#ask-input">
            Skip to the garden's chapters
          </a>
          <main>
            <h1 className="sr-only">For Dheepika — a garden of memories, 25 · 11</h1>
            <IntroHint />
            <Manifesto />
            <WorkPanel />
            <LabLabel />
            <LanternSkyLabel />
            <FinaleSky />
            <ActCard />
            <EndCap />
          </main>
          <ChapterView />
          <Contact />
          <Nav />
          <div className="journey-line" aria-hidden="true" />
        </>
      )}
      <WebGLLost />
      <NotFound />
      <CursorTrail />
    </>
  );
}
