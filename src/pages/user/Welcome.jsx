import { useNavigate } from 'react-router-dom';

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-rose-600 flex flex-col items-center justify-center text-white px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-6xl font-bold mb-4"> PENZI</h1>
        <p className="text-2xl font-semibold mb-2">Find Your Perfect Match</p>
        <p className="text-lg mb-8 opacity-90">
          Kenya's premier SMS-based dating service. Over 6000 potential matches waiting for you!
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate('/register')}
            className="bg-white text-pink-600 font-bold py-3 px-8 rounded-full text-lg hover:bg-pink-50 transition"
          >
            Get Started
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="border-2 border-white text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-white hover:text-pink-600 transition"
          >
            Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default Welcome;