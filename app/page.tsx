"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pcrfsuriabfagfxklspc.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcmZzdXJpYWJmYWdmeGtsc3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NTgxMTYsImV4cCI6MjA2NzAzNDExNn0.ErAtfFpOqC_y0Bsfgk6YCqXnRddRMqbOnco4gaKUw5k"
);

type Post = {
  id: string;
  author_id: string;
  message: string;
  photo_url?: string;
  timestamp: string | Date;
  author_name?: string;
};

export default function Home() {
  const [message, setMessage] = useState<string>("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [userId] = useState(() => {
    // Generate a consistent UUID for the public profile
    // Using a deterministic approach so it's always the same
    return "550e8400-e29b-41d4-a716-446655440000"; // Fixed UUID for public profile
  });
  const [profileName, setProfileName] = useState("Greg Wientjes");
  const [profileDetails, setProfileDetails] = useState({
    information: "",
    networks: "",
    currentCity: "",
  });
  const [profilePhoto, setProfilePhoto] = useState<string | null>("/placeholder.jpg");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;

      // Test Supabase connection
      try {
        const { data, error } = await supabase.from("posts").select("count").limit(1);
        if (error) {
          console.error("Supabase connection test failed:", error);
          alert("Database connection failed. Please check your Supabase configuration.");
          return;
        }
        console.log("Supabase connection successful");
      } catch (err) {
        console.error("Failed to connect to Supabase:", err);
        return;
      }

      const fetchPosts = async () => {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(50);
        if (error) console.error("Fetch posts error:", error.message);
        else {
          const postsWithNames = await Promise.all(
            (data as Post[]).map(async (post) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", post.author_id)
                .single();
              return { ...post, author_name: profile?.name || "Unknown" };
            })
          );
          setPosts(postsWithNames);
        }
      };

      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (error && error.code !== "PGRST116") {
          console.error("Profile fetch error:", error.message);
          return;
        }
        if (!data) {
          const { error: upsertError } = await supabase.from("profiles").upsert({
            id: userId,
            name: "Greg Wientjes",
            information: "",
            networks: "",
            current_city: "",
            photo_url: "/placeholder.jpg",
            updated_at: new Date(),
          });
          if (upsertError) console.error("Profile upsert error:", upsertError.message);
        } else {
          setProfileName(data.name || "Greg Wientjes");
          setProfileDetails({
            information: data.information || "",
            networks: data.networks || "",
            currentCity: data.current_city || "",
          });
          setProfilePhoto(data.photo_url || "/placeholder.jpg");
        }
      };

      await Promise.all([fetchPosts(), fetchProfile()]);

      const subscription = supabase
        .channel("public:profiles")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, (payload) => {
          const updatedProfile = payload.new;
          setProfileName(updatedProfile.name || "Greg Wientjes");
          setProfileDetails({
            information: updatedProfile.information || "",
            networks: updatedProfile.networks || "",
            currentCity: updatedProfile.current_city || "",
          });
          setProfilePhoto(updatedProfile.photo_url || "/placeholder.jpg");
        })
        .subscribe();

      return () => subscription.unsubscribe();
    };

    loadData();
  }, [userId]);

  const handleShare = async () => {
    if (!userId || (message.trim().length === 0 && !photo)) {
      alert("Please enter a message or add a photo before posting.");
      return;
    }
    
    try {
      const postData = {
        id: uuidv4(),
        author_id: userId,
        message: message.trim(),
        photo_url: photo || null,
        timestamp: new Date().toISOString(),
      };
      
      console.log("Attempting to insert post:", postData);
      
      const { data, error } = await supabase.from("posts").insert(postData);
      
      if (error) {
        console.error("Post insert error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        alert(`Failed to post: ${error.message}`);
      } else {
        console.log("Post inserted successfully:", data);
        setMessage("");
        setPhoto(null);
        // Refresh posts immediately
        const { data: newPosts, error: fetchError } = await supabase
          .from("posts")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(50);
          
        if (!fetchError && newPosts) {
          const postsWithNames = await Promise.all(
            (newPosts as Post[]).map(async (post) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", post.author_id)
                .single();
              return { ...post, author_name: profile?.name || "Unknown" };
            })
          );
          setPosts(postsWithNames);
        }
      }
    } catch (err) {
      console.error("Unexpected error while posting:", err);
      alert("An unexpected error occurred. Please try again.");
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert("File size must be less than 5MB");
          return;
        }
        
        const filePath = `public/${uuidv4()}-${file.name}`;
        console.log("Uploading photo to:", filePath);
        
        const { data, error } = await supabase.storage
          .from("wall-photos")
          .upload(filePath, file);
          
        if (error) {
          console.error("Photo upload error:", {
            message: error.message
          });
          alert(`Photo upload failed: ${error.message}`);
        } else {
          console.log("Photo uploaded successfully:", data);
          const { data: publicUrlData } = supabase.storage
            .from("wall-photos")
            .getPublicUrl(filePath);
          setPhoto(publicUrlData.publicUrl);
          console.log("Photo URL set:", publicUrlData.publicUrl);
        }
      } catch (err) {
        console.error("Unexpected error during photo upload:", err);
        alert("Failed to upload photo. Please try again.");
      }
    }
  };

  const handleProfilePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const filePath = `public/${uuidv4()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("wall-photos")
        .upload(filePath, file);
      if (error) console.error("Profile photo upload error:", error.message);
      else {
        const { data: publicUrlData } = supabase.storage.from("wall-photos").getPublicUrl(filePath);
        const profileData = {
          id: userId,
          name: profileName,
          information: profileDetails.information,
          networks: profileDetails.networks,
          current_city: profileDetails.currentCity,
          photo_url: publicUrlData.publicUrl,
          updated_at: new Date(),
        };
        const { error: updateError } = await supabase.from("profiles").upsert(profileData);
        if (updateError) console.error("Profile photo update error:", updateError.message);
        else setProfilePhoto(publicUrlData.publicUrl);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    const profileData = {
      id: userId,
      name: profileName,
      information: profileDetails.information,
      networks: profileDetails.networks,
      current_city: profileDetails.currentCity,
      photo_url: profilePhoto,
      updated_at: new Date(),
    };
    const { error } = await supabase.from("profiles").upsert(profileData);
    if (error) {
      console.error("Profile save error:", {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      });
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-100 to-white">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg text-center fixed w-full z-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold"><strong>Wall</strong></h1>
      </header>

      {/* Main Content with Adjusted Padding for Fixed Header */}
      <div className="flex flex-1 mt-16">
        {/* Profile Sidebar */}
        <div className="w-full md:w-1/4 bg-white p-4 md:p-6 border-r shadow-lg sticky top-16 h-full overflow-y-auto">
          <div className="text-center">
            <img
              src={profilePhoto || "/placeholder.jpg"}
              alt="Profile"
              className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full mx-auto mb-2 sm:mb-4 object-cover shadow-md border-4 border-blue-200"
            />
            <h2 className="text-xl sm:text-2xl md:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">{profileName}</h2>
            <p className="text-gray-600 mb-1 sm:mb-2"><strong>Wall</strong></p>
            <ul className="space-y-1 sm:space-y-2 mb-2 sm:mb-4">
              <li className="text-sm sm:text-base md:text-base text-gray-500"><strong>Information:</strong> {profileDetails.information}</li>
              <li className="text-sm sm:text-base md:text-base text-gray-500"><strong>Networks:</strong> {profileDetails.networks}</li>
              <li className="text-sm sm:text-base md:text-base text-gray-500"><strong>Current City:</strong> {profileDetails.currentCity}</li>
            </ul>
            <label className="cursor-pointer text-sm sm:text-base text-blue-500 mb-2 block">
              Change Photo
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleProfilePhotoUpload}
              />
            </label>
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full p-2 sm:p-2 md:p-2 border rounded mb-2 text-center bg-gray-50 text-sm sm:text-base"
                  placeholder="Enter your name"
                />
                <div className="mb-2">
                  <label className="block text-sm sm:text-base font-medium text-gray-700">Information</label>
                  <input
                    type="text"
                    value={profileDetails.information}
                    onChange={(e) => setProfileDetails((prev) => ({ ...prev, information: e.target.value }))}
                    className="w-full p-2 sm:p-2 md:p-2 border rounded mb-2 bg-gray-50 text-sm sm:text-base"
                    placeholder="Enter information"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm sm:text-base font-medium text-gray-700">Networks</label>
                  <input
                    type="text"
                    value={profileDetails.networks}
                    onChange={(e) => setProfileDetails((prev) => ({ ...prev, networks: e.target.value }))}
                    className="w-full p-2 sm:p-2 md:p-2 border rounded mb-2 bg-gray-50 text-sm sm:text-base"
                    placeholder="e.g., LinkedIn, Twitter"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm text-base font-medium text-gray-700">Current City</label>
                  <input
                    type="text"
                    value={profileDetails.currentCity}
                    onChange={(e) => setProfileDetails((prev) => ({ ...prev, currentCity: e.target.value }))}
                    className="w-full p-2 sm:p-2 md:p-2 border rounded mb-2 bg-gray-50 text-sm sm:text-base"
                    placeholder="e.g., Palo Alto, CA"
                  />
                </div>
                <button
                  className="bg-blue-600 text-white px-4 py-1 sm:py-2 rounded hover:bg-blue-700 transition w-full text-sm sm:text-base"
                  onClick={handleSaveProfile}
                >
                  Save
                </button>
              </>
            ) : (
              <button
                className="bg-blue-600 text-white px-4 py-1 sm:py-2 rounded hover:bg-blue-700 transition w-full text-sm sm:text-base"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Main Feed */}
        <div className="w-full md:w-3/4 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white p-2 sm:p-4 md:p-6 border rounded-lg shadow-md mb-2 sm:mb-4">
            <div className="flex flex-col sm:flex-row items-center mb-2 sm:mb-4">
              <textarea
                className="w-full p-2 sm:p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={280}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div className="mb-2 sm:mb-0">
                <label className="cursor-pointer flex items-center text-blue-500 hover:text-blue-700 text-sm sm:text-base">
                  <svg
                    className="w-4 sm:w-5 h-4 sm:h-5 mr-1 sm:mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Add Photo
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handlePhotoUpload}
                  />
                </label>
                <span className="text-sm sm:text-base text-gray-500 ml-1 sm:ml-2">
                  {280 - message.length} characters remaining
                </span>
              </div>
              <button
                className="bg-blue-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-blue-700 transition text-sm sm:text-base"
                onClick={handleShare}
              >
                Share
              </button>
            </div>
            {photo && (
              <img
                src={photo}
                alt="Uploaded"
                className="mt-2 sm:mt-4 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 object-cover rounded-lg shadow-md"
              />
            )}
          </div>
          <div className="space-y-2 sm:space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white p-2 sm:p-4 border rounded-lg shadow-md hover:shadow-lg transition"
              >
                <p className="text-gray-800 text-sm sm:text-base">
                  <strong className="text-blue-600">{post.author_name}</strong>{" "}
                  {post.message}
                </p>
                {post.photo_url && (
                  <img
                    src={post.photo_url}
                    alt="Post"
                    className="mt-2 sm:mt-4 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 object-cover rounded-lg shadow-md"
                  />
                )}
                <span className="text-sm text-gray-500 block mt-1 sm:mt-2">
                  {new Date(post.timestamp).toLocaleTimeString()} |{" "}
                  {new Date(post.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}