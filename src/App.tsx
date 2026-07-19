import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { Menu } from './pages/Menu';
import { CreatePlayer } from './pages/CreatePlayer';
import { Inheritance } from './pages/Inheritance';
import { SelectTeam } from './pages/SelectTeam';
import { SeasonHub } from './pages/SeasonHub';
import { Result } from './pages/Result';

function App() {
  const phase = useGame((s) => s.phase);
  const init = useGame((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-screen">
      {phase === 'menu' && <Menu />}
      {phase === 'create' && <CreatePlayer />}
      {phase === 'inherit' && <Inheritance />}
      {phase === 'select-team' && <SelectTeam />}
      {phase === 'season-hub' && <SeasonHub />}
      {phase === 'result' && <Result />}
    </div>
  );
}

export default App;
