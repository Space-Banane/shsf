import { Link } from "react-router-dom";

const NotFoundPage = () => {
	return (
	  <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
		<div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden md:max-w-2xl">
		  <div className="md:flex">
			<div className="p-8">
			  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
				Weird, that doesn't exist here!
			  </h1>
			  <Link to="/" className="text-blue-500 dark:text-blue-400 hover:underline">
				Go back to the homepage
			  </Link>
			</div>
		  </div>
		</div>
	  </div>
	);
};

export default NotFoundPage;