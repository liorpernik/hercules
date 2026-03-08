import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
// import { jwtDecode } from "jwt-decode"; // Useful if we want to decode locally to show name immediately, but not strictly needed if backend returns user info.

const Login = () => {
    const navigate = useNavigate();

    const handleSuccess = async (credentialResponse: any) => {
        try {
            const { credential } = credentialResponse;
            const res = await fetch("http://localhost:8080/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_token: credential }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                alert(`Login Failed: ${errorData.error || "Unknown error"}`);
                return;
            }

            const data = await res.json();
            // Store token and user info
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            console.log("Logged in as:", data.user);
            navigate("/"); // Redirect to Entrance Page
        } catch (err) {
            console.error("Login error:", err);
            alert("Something went wrong during login.");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900">MyHercules</h2>
                    <p className="mt-2 text-sm text-gray-600">Access your firm's workspace</p>
                </div>
                <div className="flex justify-center py-6">
                    <GoogleLogin
                        onSuccess={handleSuccess}
                        onError={() => {
                            console.log("Login Failed");
                            alert("Google Login Failed");
                        }}
                        useOneTap
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
