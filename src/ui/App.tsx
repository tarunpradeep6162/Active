import { Nav } from './Nav';
import { Preloader, IntroHint, Manifesto, WorkPanel, LabLabel, EndCap, Contact, WebGLLost } from './Sections';
import { useStore } from './useStore';
import { ChapterView } from '../birthday/ui/ChapterView';
import '../birthday/ui/birthday.css';

export function App() {
  const revealed = useStore((s) => s.revealed);
  return (
    <>
      <Preloader />
      {revealed && (
        <>
          <a className="sr-only sr-only-focusable" href="#ask-input">
            Skip to work search
          </a>
          <main>
            <h1 className="sr-only">Meridian Field — realtime digital experiences</h1>
            <IntroHint />
            <Manifesto />
            <WorkPanel />
            <LabLabel />
            <EndCap />
          </main>
          <ChapterView />
          <Contact />
          <Nav />
        </>
      )}
      <WebGLLost />
    </>
  );
}
