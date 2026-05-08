import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const photos = [
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&q=80",
  "https://images.unsplash.com/photo-1529636798458-92182e662485?w=800&q=80",
  "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&q=80",
  "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80",
  "https://images.unsplash.com/photo-1502945015378-0e284ca1a5be?w=800&q=80",
];

function Welcome() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % photos.length);
        setFade(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Navbar */}
      <nav className="flex justify-between items-center px-10 py-5 bg-black">
        <div>
          <span className="text-2xl font-extrabold text-pink-500">PENZI</span>
          <span className="text-gray-400 text-sm ml-2">Dating Platform</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/login")}
            className="border-2 border-pink-500 text-pink-500 font-semibold px-5 py-2 rounded-full hover:bg-pink-600 hover:text-white transition text-sm"
          >
            Login
          </button>
          <button
            onClick={() => navigate("/register")}
            className="bg-pink-600 text-white font-semibold px-5 py-2 rounded-full hover:bg-pink-700 transition text-sm"
          >
            Sign Up
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="text-gray-400 font-semibold px-5 py-2 rounded-full hover:text-pink-500 transition text-sm"
          >
            Admin
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-1 items-center">

        {/* Left Side - Static Content */}
        <div className="flex-1 px-16 py-12">
          <p className="text-pink-500 font-semibold text-sm uppercase tracking-widest mb-4">
            Kenya's Premier Dating Platform.
          </p>

          <h1 className="text-5xl font-extrabold text-gray-800 leading-tight mb-6">
            Find Your <br />
            <span className="text-pink-600">Perfect Match</span> <br />
            Today
          </h1>

          <p className="text-gray-500 text-lg mb-8 max-w-md leading-relaxed">
            Join thousands of Kenyans finding love every day.
            Register for free and start connecting with compatible partners across all 47 counties.
          </p>

          {/* Stats */}
          <div className="flex gap-8 mb-10">
            <div>
              <p className="text-3xl font-bold text-pink-600">6,000+</p>
              <p className="text-gray-400 text-sm">Active Members</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <p className="text-3xl font-bold text-pink-600">47</p>
              <p className="text-gray-400 text-sm">Counties</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <p className="text-3xl font-bold text-pink-600">100%</p>
              <p className="text-gray-400 text-sm">Free</p>
            </div>
          </div>

          {/* CTA Button - only Get Started */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/register")}
              className="bg-pink-600 text-white font-bold py-4 px-10 rounded-full text-lg hover:bg-pink-700 transition shadow-md"
            >
              Get Started
            </button>
          </div>

          {/* Steps */}
          <div className="flex gap-6 mt-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                <span className="text-pink-600 text-sm font-bold">1</span>
              </div>
              <span className="text-gray-500 text-sm">Register Free</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                <span className="text-pink-600 text-sm font-bold">2</span>
              </div>
              <span className="text-gray-500 text-sm">Find Matches</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                <span className="text-pink-600 text-sm font-bold">3</span>
              </div>
              <span className="text-gray-500 text-sm">Connect</span>
            </div>
          </div>
        </div>

        {/* Right Side - Dynamic Photos */}
        <div className="flex-1 relative h-screen max-h-screen overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
            style={{
              backgroundImage: `url(${photos[current]})`,
              opacity: fade ? 1 : 0,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-transparent w-32" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-8">
            <p className="text-white font-semibold text-lg">Real Love Stories</p>
            <p className="text-white opacity-70 text-sm">Thousands of Kenyans have found love through Penzi</p>
          </div>
          <div className="absolute bottom-6 right-6 flex gap-2">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "bg-white w-6" : "bg-white opacity-40 w-2"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black text-white">
        <div className="px-10 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div>
            <h2 className="text-xl font-extrabold text-pink-500 mb-3">PENZI</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              By clicking Get Started, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate("/")}
                  className="text-gray-400 text-sm hover:text-pink-500 transition"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/register")}
                  className="text-gray-400 text-sm hover:text-pink-500 transition"
                >
                  Register
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/login")}
                  className="text-gray-400 text-sm hover:text-pink-500 transition"
                >
                  Login
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/admin")}
                  className="text-gray-400 text-sm hover:text-pink-500 transition"
                >
                  Admin
                </button>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="text-white font-semibold mb-4">About</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-gray-400 text-sm">
                  Penzi is a free dating service available via SMS and web across Kenya.
                  We help compatible singles connect based on location, age and interests.
                </span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2">
              <li className="text-gray-400 text-sm">
                SMS: <span className="text-pink-500">22141</span>
              </li>
              <li className="text-gray-400 text-sm">
                Email: <span className="text-pink-500">support@penzi.co.ke</span>
              </li>
              <li className="text-gray-400 text-sm">
                Phone: <span className="text-pink-500">+254 792 491 291</span>
              </li>
              <li className="text-gray-400 text-sm">
                Location: <span className="text-white">Nairobi, Kenya</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 px-10 py-4 flex justify-between items-center">
          <p className="text-gray-500 text-sm">
            2026 Penzi Dating Platform. All rights reserved.
          </p>
          <div className="flex gap-4">
            <span className="text-gray-500 text-sm hover:text-pink-500 cursor-pointer transition">
              Privacy Policy
            </span>
            <span className="text-gray-500 text-sm hover:text-pink-500 cursor-pointer transition">
              Terms of Service
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default Welcome;