"use client";

import {
  useState,
  useEffect,
} from "react";

import {
  db,
  storage,
} from "@/firebase/config";

import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

export default function ProfilePage() {

  const [
    name,
    setName,
  ] = useState("");

  const [
    city,
    setCity,
  ] = useState("");

  const [
    stateVal,
    setStateVal,
  ] = useState("");

  const [
    country,
    setCountry,
  ] = useState("");

  const [
    pincode,
    setPincode,
  ] = useState("");

  const [
    address,
    setAddress,
  ] = useState("");

  const [
    gender,
    setGender,
  ] = useState("");

  const [
    bio,
    setBio,
  ] = useState("");

  const [
    interests,
    setInterests,
  ] = useState("");

  const [
    college,
    setCollege,
  ] = useState("");

  /* NEW */

  const [
    photoURL,
    setPhotoURL,
  ] = useState("");

  const [
    uploadLoading,
    setUploadLoading,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const phone =
    typeof window !==
    "undefined"
      ? localStorage.getItem(
          "phone"
        )
      : null;

  const guest =
    typeof window !==
    "undefined"
      ? localStorage.getItem(
          "guest"
        ) === "true"
      : false;

  /* ------------------------------------------
        FETCH PROFILE VALUES
  ------------------------------------------- */

  useEffect(() => {

    if (!phone) {

      setLoading(false);

      return;
    }

    const fetchProfile =
      async () => {

        try {

          const userRef =
            doc(
              db,
              "users",
              phone
            );

          const snapshot =
            await getDoc(
              userRef
            );

          if (
            snapshot.exists()
          ) {

            const data =
              snapshot.data() as any;

            setName(
              data.name || ""
            );

            setCity(
              data.city || ""
            );

            setStateVal(
              data.state || ""
            );

            setCountry(
              data.country || ""
            );

            setPincode(
              data.pincode || ""
            );

            setAddress(
              data.address || ""
            );

            setGender(
              data.gender || ""
            );

            setBio(
              data.bio || ""
            );

            setInterests(
              data.interests || ""
            );

            setCollege(
              data.college || ""
            );

            setPhotoURL(
              data.photoURL || ""
            );
          }

        } catch (error) {

          console.error(
            error
          );
        }

        setLoading(false);
      };

    fetchProfile();

  }, [phone]);

  /* ------------------------------------------
        IMAGE UPLOAD
  ------------------------------------------- */

  const handleImageUpload =
    async (
      e: any
    ) => {

      try {

        const file =
          e.target.files[0];

        if (!file)
          return;

        if (!phone)
          return;

        setUploadLoading(
          true
        );

        const imageRef =
          ref(
            storage,
            `profilePictures/${phone}_${Date.now()}`
          );

        await uploadBytes(
          imageRef,
          file
        );

        const downloadURL =
          await getDownloadURL(
            imageRef
          );

        setPhotoURL(
          downloadURL
        );

        alert(
          "Profile photo uploaded ✅"
        );

      } catch (error) {

        console.error(
          error
        );

        alert(
          "Image upload failed ❌"
        );

      } finally {

        setUploadLoading(
          false
        );
      }
    };

  /* ------------------------------------------
        SAVE PROFILE
  ------------------------------------------- */

  const saveProfile =
    async () => {

      if (guest) {

        return alert(
          "You are in guest mode. Please login to save your profile."
        );
      }

      if (!phone)
        return alert(
          "Login again. Phone number missing!"
        );

      try {

        setSaving(true);

        const userRef =
          doc(
            db,
            "users",
            phone
          );

        await setDoc(
          userRef,
          {
            phone,

            name,

            city,

            state:
              stateVal,

            country,

            pincode,

            address,

            gender,

            bio,

            interests,

            college,

            /* NEW */

            photoURL,

            verified:
              true,

            profileCompleted:
              true,

            profileStrength:
              [
                name,
                city,
                gender,
                bio,
                interests,
                college,
                photoURL,
              ].filter(
                Boolean
              ).length *
              15,

            updatedAt:
              new Date(),
          },
          {
            merge: true,
          }
        );

        alert(
          "Profile saved successfully!"
        );

        window.location.href =
          "/categories";

      } catch (error) {

        console.error(
          error
        );

        alert(
          "Failed to save profile"
        );

      } finally {

        setSaving(false);
      }
    };

  /* ------------------------------------------
        LOGOUT
  ------------------------------------------- */

  const logout = () => {

    localStorage.clear();

    window.location.href =
      "/login";
  };

  /* ------------------------------------------
        LOGIN CHECK
  ------------------------------------------- */

  if (
    !phone &&
    !guest
  ) {

    return (
      <div className="pt-32 px-6 text-white text-center">

        <h1 className="text-3xl font-bold text-[#FFD700]">
          Profile
        </h1>

        <p className="mt-3 text-gray-300">
          Please login first to update your profile.
        </p>

      </div>
    );
  }

  /* ------------------------------------------
        LOADING
  ------------------------------------------- */

  if (loading)

    return (
      <div className="pt-32 px-6 text-white text-center">
        Loading Profile...
      </div>
    );

  /* ------------------------------------------
        PROFILE STRENGTH
  ------------------------------------------- */

  const profileStrength =
    [
      name,
      city,
      gender,
      bio,
      interests,
      college,
      photoURL,
    ].filter(
      Boolean
    ).length * 15;

  /* ------------------------------------------
        UI
  ------------------------------------------- */

  return (
    <div className="text-white pt-32 flex flex-col items-center gap-5 px-6 pb-20">

      <h1 className="text-3xl font-bold text-[#FFD700] mb-1">
        Your Profile
      </h1>

      {/* PROFILE IMAGE */}

      <div className="relative">

        <img
          src={
            photoURL ||
            "https://ui-avatars.com/api/?background=000000&color=FFD700&name=User"
          }
          alt="Profile"
          className="w-28 h-28 rounded-full border-4 border-[#FFD700] object-cover shadow-lg"
        />

      </div>

      {/* IMAGE PICKER */}

      {!guest && (

        <label className="cursor-pointer text-sm text-[#FFD700] underline">

          {uploadLoading
            ? "Uploading..."
            : "Upload Profile Photo"}

          <input
            type="file"
            accept="image/*"
            hidden
            onChange={
              handleImageUpload
            }
          />

        </label>
      )}

      {/* PROFILE COMPLETION */}

      <div className="w-72">

        <div className="flex justify-between text-xs mb-1 text-gray-400">

          <span>
            Profile Strength
          </span>

          <span>
            {profileStrength}%
          </span>

        </div>

        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">

          <div
            className="h-full bg-[#FFD700]"
            style={{
              width:
                `${profileStrength}%`,
            }}
          />

        </div>

      </div>

      {/* NOTE */}

      <div className="max-w-md text-center text-xs text-gray-400 mb-2">

        SplitPartnering is a{" "}

        <span className="text-[#FFD700] font-semibold">
          partnering service
        </span>

        . We help people find partners to share costs and access group benefits.

      </div>

      <p className="text-gray-400 text-sm mb-2">

        {guest
          ? "Guest Mode: You can browse, but cannot save details."
          : "Keep your profile accurate. Partners trust verified details."}

      </p>

      {/* PHONE */}

      <div className="bg-black/50 border border-[#FFD700]/30 px-4 py-2 rounded-lg w-72 text-center text-sm mb-2">

        Phone:{" "}

        <span className="text-[#FFD700] font-semibold">

          {phone
            ? phone
            : "Guest"}

        </span>

      </div>

      {/* NAME */}

      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) =>
          setName(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* GENDER */}

      <select
        value={gender}
        onChange={(e) =>
          setGender(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700] bg-black"
        disabled={guest}
      >

        <option value="">
          Select Gender
        </option>

        <option value="Male">
          Male
        </option>

        <option value="Female">
          Female
        </option>

        <option value="Other">
          Other
        </option>

      </select>

      {/* COLLEGE */}

      <input
        type="text"
        placeholder="College / Company"
        value={college}
        onChange={(e) =>
          setCollege(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* CITY */}

      <input
        type="text"
        placeholder="City"
        value={city}
        onChange={(e) =>
          setCity(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* STATE */}

      <input
        type="text"
        placeholder="State"
        value={stateVal}
        onChange={(e) =>
          setStateVal(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* COUNTRY */}

      <input
        type="text"
        placeholder="Country"
        value={country}
        onChange={(e) =>
          setCountry(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* PINCODE */}

      <input
        type="text"
        placeholder="Pincode"
        value={pincode}
        onChange={(e) =>
          setPincode(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* INTERESTS */}

      <input
        type="text"
        placeholder="Interests (Movies, Trips, Food...)"
        value={interests}
        onChange={(e) =>
          setInterests(
            e.target.value
          )
        }
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* BIO */}

      <textarea
        placeholder="Short Bio"
        value={bio}
        onChange={(e) =>
          setBio(
            e.target.value
          )
        }
        className="neon-input w-72 h-20 resize-none border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* ADDRESS */}

      <textarea
        placeholder="Address"
        value={address}
        onChange={(e) =>
          setAddress(
            e.target.value
          )
        }
        className="neon-input w-72 h-20 resize-none border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* SAVE */}

      {!guest && (

        <button
          onClick={
            saveProfile
          }
          disabled={
            saving
          }
          className="bg-[#FFD700] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#FFEB99] transition-all mt-2 disabled:opacity-50"
        >

          {saving
            ? "Saving..."
            : "Save Profile"}

        </button>
      )}

      {/* VERIFIED BADGE */}

      <div className="text-green-400 text-xs mt-2">
        ✅ Verified Partner Profile
      </div>

      {/* TRUST */}

      <div className="max-w-md text-center text-[11px] text-gray-400 mt-2">

        Your details help us suggest better partners in your city.
        Payments and purchases always happen directly between partners and providers.

      </div>

      {/* LOGOUT */}

      <button
        onClick={
          logout
        }
        className="text-red-400 underline text-sm mt-3"
      >
        Logout
      </button>

      {/* ADMIN */}

      <button
        onClick={() =>
          (
            window.location.href =
              "/admin"
          )
        }
        className="text-[10px] opacity-20 mt-1"
      >
        admin
      </button>

      {/* AI */}

      <button
        onClick={() =>
          (
            window.location.href =
              "/ai"
          )
        }
        className="mt-4 text-[#FFD700] text-sm underline"
      >
        Chat with AI 🤖
      </button>

    </div>
  );
}