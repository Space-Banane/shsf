import AppRoutes, { routes } from "./Routes";
import ThemeToggle from "./components/ThemeToggle";

function App() {
	return (
		<div className="min-h-screen bg-white dark:bg-gray-900 transition-colors flex flex-col">
			<div className="mx-auto p-4 flex-grow w-full">
				<header className="bg-white shadow-md dark:bg-gray-800 mb-8">
					<div className="flex justify-between items-center p-4">
						<nav>
							<ul className="flex space-x-4">
								{routes.map((route) => (
									<li key={route.path}>
										<a
											href={route.path}
											className={`text-blue-500 hover:text-blue-700 font-semibold px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition duration-200`}
										>
											{route.name}
										</a>
									</li>
								))}
							</ul>
						</nav>
						<ThemeToggle />
					</div>
				</header>
				<main className="text-gray-800 dark:text-gray-200">
					<AppRoutes />
				</main>
			</div>
			<footer className="bg-white shadow-md dark:bg-gray-800 p-4 mt-8">
				<div className="text-center text-gray-600 dark:text-gray-400">
					© {new Date().getFullYear()}. By <a href="https://space.reversed.dev" className="text-blue-500 hover:text-blue-700">Space</a>
				</div>
			</footer>
		</div>
	);
}
export default App;
