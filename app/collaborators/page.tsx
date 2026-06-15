"use client";

import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// India states data (same as profile page)
const indiaStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

// 9 PartnerSync categories with specific subcategories
const partnerCategories: Record<string, { name: string; icon: string; subcategories: string[] }> = {
  "Gym": {
    name: "Gym", icon: "💪",
    subcategories: ["Monthly Membership", "Quarterly Membership", "Yearly Membership", "Personal Training", "Couple Membership"]
  },
  "Fashion": {
    name: "Fashion", icon: "👗",
    subcategories: ["Group Shopping", "Bulk Orders", "Sneakers", "Beauty Products", "Brand Purchases", "Festival Collections"]
  },
  "Movies": {
    name: "Movies", icon: "🎬",
    subcategories: ["PVR", "INOX", "Weekend Shows", "Premium Seats", "Movie Passes"]
  },
  "Lenskart": {
    name: "Lenskart", icon: "👓",
    subcategories: ["Eyeglasses", "Sunglasses", "Contact Lenses", "Premium Frames", "Kids Eyewear"]
  },
  "Local Travel": {
    name: "Local Travel", icon: "🚗",
    subcategories: ["Cab Sharing", "Bike Sharing", "Commute Partner", "Route Match", "Weekend Trips"]
  },
  "Events": {
    name: "Events", icon: "🎤",
    subcategories: ["Concerts", "Comedy Shows", "Music Festivals", "Sports Events", "Cultural Events"]
  },
  "Coupons": {
    name: "Coupons", icon: "🎟️",
    subcategories: ["Zomato", "Swiggy", "Amazon", "Myntra", "Flipkart", "Food Delivery"]
  },
  "Villas": {
    name: "Villas", icon: "🏡",
    subcategories: ["Weekend Stay", "Group Stay", "Pool Villas", "Beach Villas", "Hill Villas"]
  },
  "Books": {
    name: "Books", icon: "📚",
    subcategories: ["Book Exchange", "Second-Hand Books", "Competitive Exam Books", "Engineering Books", "Academic Books", "Novel Community"]
  }
};

// Districts data from cities.js (simplified for form)
const districtsByState: Record<string, string[]> = {
  "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Nellore", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Mahbubnagar", "Medak", "Nalgonda", "Adilabad", "Ranga Reddy", "Vikarabad", "Sangareddy", "Kamareddy", "Jagtial", "Peddapalli", "Mahabubabad", "Suryapet", "Mancherial", "Nirmal", "Jangaon", "Bhadradri Kothagudem", "Mulugu", "Medchal-Malkajgiri", "Rajanna Sircilla", "Siddipet", "Wanaparthy", "Nagarkurnool", "Yadadri Bhuvanagiri", "Komaram Bheem Asifabad", "Jogulamba Gadwal", "Narayanpet"],
  "Maharashtra": ["Mumbai City", "Mumbai Suburban", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Kolhapur", "Satara", "Jalgaon", "Amravati", "Latur", "Nanded", "Hingoli", "Parbhani", "Buldhana", "Akola", "Washim", "Yavatmal", "Wardha", "Dhule", "Nandurbar", "Raigad", "Ratnagiri", "Sindhudurg", "Sangli", "Osmanabad", "Beed", "Ahmednagar", "Palghar", "Jalna", "Gondia", "Gadchiroli", "Bhandara", "Chandrapur"],
  "Karnataka": ["Bengaluru Urban", "Bengaluru Rural", "Belagavi", "Mysuru", "Hubli-Dharwad", "Mangaluru", "Kalaburagi", "Udupi", "Shivamogga", "Tumakuru", "Ballari", "Vijayapura", "Dakshina Kannada", "Chikkamagaluru", "Hassan", "Davanagere", "Kolar", "Chitradurga", "Raichur", "Bidar", "Koppal", "Gadag", "Bagalkot", "Haveri", "Chikkaballapur", "Ramanagara", "Kodagu", "Karwar", "Chamarajanagar", "Mandya", "Uttara Kannada", "Yadgir"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Vellore", "Erode", "Tirunelveli", "Thoothukudi", "Kanyakumari", "Dindigul", "Cuddalore", "Thanjavur", "Nagapattinam", "Tiruvannamalai", "Villupuram", "Kanchipuram", "Ramanathapuram", "Virudhunagar", "Karur", "Perambalur", "Theni", "Tirupur", "Nilgiris", "Dharmapuri", "Krishnagiri", "Ariyalur", "Chengalpattu", "Ranipet", "Tirupattur", "Kallakurichi", "Tenkasi", "Mayiladuthurai", "Tiruvallur", "Namakkal", "Sivaganga", "Pudukkottai"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Alappuzha", "Thrissur", "Palakkad", "Kannur", "Kottayam", "Malappuram", "Pathanamthitta", "Wayanad", "Idukki", "Kasaragod", "Ernakulam"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Kutch", "Anand", "Mehsana", "Patan", "Banaskantha", "Bharuch", "Navsari", "Valsad", "Surendranagar", "Amreli", "Kheda", "Morbi", "Mahisagar", "Aravalli", "Panchmahal", "Dahod", "Chhota Udaipur", "Devbhumi Dwarka", "Narmada", "Gir Somnath", "Tapi", "Porbandar", "Botad"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Ghaziabad", "Noida", "Meerut", "Bareilly", "Aligarh", "Moradabad", "Jhansi", "Gorakhpur", "Mathura", "Lakhimpur Kheri", "Saharanpur", "Faizabad/Ayodhya", "Azamgarh", "Mau", "Ballia", "Basti", "Siddharthnagar", "Maharajganj", "Deoria", "Kushinagar", "Gonda", "Bahraich", "Barabanki", "Raebareli", "Sultanpur", "Mirzapur", "Banda", "Hamirpur", "Mahoba", "Jalaun", "Etawah", "Mainpuri", "Firozabad", "Hathras", "Ambedkar Nagar", "Sambhal", "Rampur", "Amroha", "Bijnor", "Muzaffarnagar", "Gautam Buddha Nagar", "Bulandshahr", "Hapur", "Shahjahanpur", "Pilibhit", "Hardoi", "Sitapur", "Unnao", "Fatehpur", "Pratapgarh", "Kaushambi", "Chitrakoot", "Auraiya", "Kannauj", "Farrukhabad", "Etah", "Kasganj", "Budaun", "Shravasti", "Ayodhya"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Alwar", "Bhilwara", "Sikar", "Jhunjhunu", "Churu", "Sri Ganganagar", "Hanumangarh", "Bharatpur", "Dholpur", "Pali", "Sirohi", "Jalore", "Barmer", "Nagaur", "Tonk", "Banswara", "Pratapgarh", "Dungarpur", "Rajsamand", "Chittorgarh", "Baran", "Jhalawar", "Bundi", "Sawai Madhopur", "Karauli", "Dausa", "Jaisalmer", "Anupgarh", "Balotra", "Beawar", "Didwana-Kuchaman", "Kekri", "Neem Ka Thana", "Phulera", "Sanchore"],
  "West Bengal": ["Kolkata", "Howrah", "North 24 Parganas", "South 24 Parganas", "Hooghly", "Bardhaman", "Paschim Bardhaman", "Purba Bardhaman", "Bankura", "Birbhum", "Jalpaiguri", "Darjeeling", "Kalimpong", "Midnapore", "Paschim Medinipur", "Purba Medinipur", "Murshidabad", "Nadia", "Malda", "Cooch Behar", "Dakshin Dinajpur", "Uttar Dinajpur", "Purulia", "Alipurduar", "Jhargram"],
  "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnia", "Munger", "Nalanda", "West Champaran", "East Champaran", "Gopalganj", "Saran", "Siwan", "Vaishali", "Bhojpur", "Buxar", "Rohtas", "Aurangabad", "Samastipur", "Begusarai", "Saharsa", "Madhepura", "Supaul", "Araria", "Kishanganj", "Madhubani", "Sitamarhi", "Khagaria", "Katihar", "Banka", "Lakhisarai", "Sheikhpura", "Nawada", "Jamui", "Jehanabad", "Arwal", "Kaimur", "Sheohar"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Rewa", "Satna", "Ratlam", "Mandsaur", "Shahdol", "Hoshangabad", "Chhindwara", "Morena", "Bhind", "Vidisha", "Dewas", "Dhar", "Khandwa", "Khargone", "Neemuch", "Guna", "Shivpuri", "Tikamgarh", "Chhatarpur", "Panna", "Damoh", "Seoni", "Mandla", "Balaghat", "Narsinghpur", "Raisen", "Sehore", "Rajgarh", "Shajapur", "Barwani", "Jhabua", "Alirajpur", "Burhanpur", "Dindori", "Umaria", "Katni", "Ashoknagar", "Anuppur", "Singrauli", "Sidhi", "Sheopur", "Betul", "Harda", "Agar Malwa"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Chandigarh", "Mohali", "Bathinda", "Hoshiarpur", "Gurdaspur", "Firozpur", "Faridkot", "Sri Muktsar Sahib", "Sangrur", "Barnala", "Kapurthala", "Shaheed Bhagat Singh Nagar", "Rupnagar", "Fatehgarh Sahib", "Moga", "Tarn Taran", "Pathankot", "Fazilka", "Malerkotla", "Mansa", "SAS Nagar"],
  "Haryana": ["Faridabad", "Gurugram", "Panchkula", "Ambala", "Karnal", "Sonipat", "Rohtak", "Hisar", "Panipat", "Yamunanagar", "Jind", "Kaithal", "Rewari", "Mahendragarh", "Bhiwani", "Jhajjar", "Fatehabad", "Sirsa", "Kurukshetra", "Palwal", "Nuh", "Charkhi Dadri"],
  "Odisha": ["Khordha", "Cuttack", "Puri", "Bhubaneswar", "Balasore", "Sambalpur", "Berhampur", "Rourkela", "Jharsuguda", "Bargarh", "Balangir", "Jajpur", "Dhenkanal", "Bhadrak", "Kendrapara", "Mayurbhanj", "Keonjhar", "Kalahandi", "Kandhamal", "Koraput", "Malkangiri", "Nabarangpur", "Nayagarh", "Ganjam", "Gajapati", "Rayagada", "Nuapada", "Sonepur", "Boudh", "Deogarh", "Angul", "Jagatsinghpur", "Subarnapur"],
  "Assam": ["Guwahati Metro", "Kamrup", "Kamrup Metropolitan", "Nagaon", "Dibrugarh", "Tinsukia", "Jorhat", "Sivasagar", "Cachar", "Barpeta", "Dhubri", "Goalpara", "Bongaigaon", "Kokrajhar", "Lakhimpur", "Dhemaji", "Sonitpur", "Hailakandi", "Karimganj", "Golaghat", "Darrang", "Udalguri", "Chirang", "Baksa", "Majuli", "Hojai", "Charaideo", "Biswanath", "South Salmara", "West Karbi Anglong", "Karbi Anglong", "Morigaon", "Nalbari"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh", "Deoghar", "Dumka", "Giridih", "East Singhbhum", "West Singhbhum", "Palamu", "Latehar", "Garhwa", "Godda", "Sahibganj", "Koderma", "Simdega", "Khunti", "Pakur", "Jamtara", "Ramgarh", "Saraikela Kharsawan", "Lohardaga"],
  "Himachal Pradesh": ["Shimla", "Kangra", "Manali-Kullu", "Mandi", "Solan", "Hamirpur", "Una", "Bilaspur", "Chamba", "Sirmaur", "Kinnaur", "Lahaul and Spiti"],
  "Chhattisgarh": ["Raipur", "Bilaspur", "Durg", "Raigarh", "Korba", "Jashpur", "Surguja", "Bastar", "Janjgir-Champa", "Kanker", "Mahasamund", "Dhamtari", "Balod", "Baloda Bazar", "Sukma", "Bijapur", "Narayanpur", "Gariaband", "Kondagaon", "Bemetara", "Mungeli", "Kabirdham", "Balrampur", "Surajpur", "Koriya", "Dantewada"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Nainital", "Haldwani", "Roorkee", "Udham Singh Nagar", "Pauri Garhwal", "Tehri Garhwal", "Chamoli", "Pithoragarh", "Almora", "Bageshwar", "Champawat", "Rudraprayag", "Uttarkashi"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Baramulla", "Anantnag", "Budgam", "Bandipora", "Ganderbal", "Kulgam", "Pulwama", "Rajouri", "Poonch", "Kupwara", "Doda", "Udhampur", "Reasi", "Ramban", "Kishtwar", "Samba", "Kathua"],
  "Goa": ["North Goa", "South Goa"]
};

// Cities by district (partial - major cities for form)
const citiesByDistrict: Record<string, Record<string, string[]>> = {
  "Andhra Pradesh": {
    "Guntur": ["Guntur", "Tenali", "Narasaraopet", "Mangalagiri", "Repalle", "Sattenapalle", "Vinukonda"],
    "Krishna": ["Vijayawada", "Machilipatnam", "Gudivada", "Nuzvid", "Jaggayyapeta"],
    "Visakhapatnam": ["Visakhapatnam", "Vizianagaram", "Anakapalle", "Bheemunipatnam", "Narsipatnam"],
  },
  "Telangana": {
    "Hyderabad": ["Hyderabad", "Secunderabad", "Gachibowli", "Madhapur", "Kukatpally", "Jubilee Hills", "Banjara Hills"],
    "Warangal": ["Warangal", "Hanamkonda", "Kazipet"],
    "Ranga Reddy": ["Rajendranagar", "Shamshabad", "Ibrahimpatnam"],
  },
  "Maharashtra": {
    "Mumbai City": ["Mumbai", "Colaba", "Dadar", "Fort"],
    "Mumbai Suburban": ["Andheri", "Bandra", "Borivali", "Kurla", "Ghatkopar"],
    "Pune": ["Pune", "Pimpri-Chinchwad", "Shivajinagar", "Kothrud", "Hadapsar"],
    "Nagpur": ["Nagpur", "Ramtek", "Umred"],
    "Thane": ["Thane", "Kalyan", "Dombivli", "Bhiwandi", "Ulhasnagar", "Ambernath"],
  },
  "Karnataka": {
    "Bengaluru Urban": ["Bengaluru", "Yelahanka", "Whitefield", "Electronic City"],
    "Belagavi": ["Belagavi", "Nippani", "Chikkodi", "Gokak"],
    "Mysuru": ["Mysuru", "Srirangapatna", "Krishnarajanagara"],
    "Hubli-Dharwad": ["Hubli", "Dharwad", "Annigeri"],
  },
  "Tamil Nadu": {
    "Chennai": ["Chennai", "Tambaram", "Avadi", "Pallavaram", "Chromepet"],
    "Coimbatore": ["Coimbatore", "Tirupur", "Pollachi", "Mettupalayam"],
    "Madurai": ["Madurai", "Kariapatti", "Thirumangalam"],
  },
  "Delhi": {
    "Central Delhi": ["Chandni Chowk", "Daryaganj", "Karol Bagh", "Paharganj"],
    "South Delhi": ["Hauz Khas", "Saket", "Greater Kailash", "Lajpat Nagar"],
    "New Delhi": ["Connaught Place", "India Gate", "Chanakyapuri"],
    "West Delhi": ["Rajouri Garden", "Vikas Puri", "Punjabi Bagh", "Uttam Nagar"],
  },
  "Gujarat": {
    "Ahmedabad": ["Ahmedabad", "Sanand", "Dholka"],
    "Surat": ["Surat", "Bardoli", "Mahuva"],
    "Vadodara": ["Vadodara", "Padra", "Dabhoi"],
  },
  "Rajasthan": {
    "Jaipur": ["Jaipur", "Chomu", "Bassi", "Jamwa Ramgarh"],
    "Jodhpur": ["Jodhpur", "Bilara", "Phalodi"],
    "Udaipur": ["Udaipur", "Rajsamand", "Fatehnagar"],
  },
};

export default function CollaboratorsPage() {
  const [formData, setFormData] = useState({
    category: "",
    subcategory: "",
    state: "",
    district: "",
    city: "",
    option: "",
    businessName: "",
    phone: "",
    email: "",
    website: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const currentSubcategories = selectedCategory ? partnerCategories[selectedCategory]?.subcategories || [] : [];
  const currentDistricts = formData.state ? districtsByState[formData.state] || [] : [];
  const currentCities = (formData.state && formData.district && citiesByDistrict[formData.state]) 
    ? (citiesByDistrict[formData.state][formData.district] || [])
    : [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Reset dependent fields
      if (name === "state") { updated.district = ""; updated.city = ""; }
      if (name === "district") { updated.city = ""; }
      if (name === "category") { updated.subcategory = ""; }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.category || !formData.subcategory || !formData.state || !formData.district || !formData.city || !formData.option || !formData.phone) {
      setError("Please fill all required fields marked with *");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "collaborators"), {
        category: formData.category,
        subcategory: formData.subcategory,
        option: formData.option,
        businessName: formData.businessName || formData.option,
        state: formData.state,
        district: formData.district,
        city: formData.city,
        phone: formData.phone,
        email: formData.email || "",
        website: formData.website || "",
        description: formData.description || "",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      const errorCode = err?.code || "";
      const errorMsg = err?.message || "";
      
      if (errorCode === "permission-denied" || errorMsg.includes("permission_denied")) {
        setError("Firebase security rules are blocking the write. Please deploy the updated firestore.rules to Firebase Console first (see Settings → Rules).");
      } else if (errorCode === "unavailable" || errorMsg.includes("unavailable")) {
        setError("Network error. Please check your internet connection and try again.");
      } else {
        setError(`Failed to submit: ${errorMsg.substring(0, 100)}`);
      }
    }
    setSubmitting(false);
  };

  const categoryKeys = Object.keys(partnerCategories);

  return (
    <main className="min-h-screen bg-black text-white pb-mobile-cta">
      
      {/* Hero */}
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4"
          >
            Become a PartnerSync Collaborator
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto mb-8"
          >
            Reach users already searching for partnerships in your category. Get listed automatically across PartnerSync.
          </motion.p>
        </div>
      </section>

      {/* Category Cards */}
      <section className="px-4 pb-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-xl text-[#FFD166] mb-4 text-center">Select Your Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoryKeys.map((key) => {
              const cat = partnerCategories[key];
              const isSelected = selectedCategory === key;
              return (
                <motion.button
                  key={key}
                  onClick={() => { setSelectedCategory(key); setFormData(prev => ({ ...prev, category: key, subcategory: "" })); }}
                  whileHover={{ y: -2 }}
                  className={`card-premium p-4 text-left transition-all ${
                    isSelected ? "border-[#FFD166] ring-1 ring-[#FFD166]/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{cat.name}</h3>
                      <p className="text-[10px] text-gray-400">{cat.subcategories.length} subcategories</p>
                    </div>
                    {isSelected && <span className="ml-auto text-[#FFD166] text-xs">✓</span>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section id="register" className="px-4 pb-20">
        <div className="max-w-lg mx-auto">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-premium p-8 text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-[#FFD166] mb-2">Partnership Request Submitted!</h2>
              <p className="text-sm text-gray-400 mb-6">
                Our team will review your application. Once approved, <span className="text-[#FFD166]">{formData.option}</span> will appear under {formData.category} → {formData.subcategory}.
              </p>
              <Link href="/" className="btn-primary text-sm">Back to Home</Link>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-premium p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#FFD166] mb-1">Business Registration</h2>
              <p className="text-xs text-gray-400 mb-6">Fill in your business details to get listed on PartnerSync</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                  >
                    <option value="">Select Category</option>
                    {categoryKeys.map(key => (
                      <option key={key} value={key}>{partnerCategories[key].icon} {key}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory */}
                {formData.category && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Subcategory *</label>
                    <select
                      name="subcategory"
                      value={formData.subcategory}
                      onChange={handleChange}
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                    >
                      <option value="">Select Subcategory</option>
                      {currentSubcategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Location - State */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">State *</label>
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                    >
                      <option value="">State</option>
                      {indiaStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">District *</label>
                    <select
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      disabled={!formData.state}
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none disabled:opacity-40"
                    >
                      <option value="">District</option>
                      {currentDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">City *</label>
                    <select
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!formData.district}
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none disabled:opacity-40"
                    >
                      <option value="">City</option>
                      {currentCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Brand/Option */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Brand / Offer Name *</label>
                  <input
                    type="text"
                    name="option"
                    value={formData.option}
                    onChange={handleChange}
                    placeholder="e.g. Nike, QuickFit, PVR Gold Seats"
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                  />
                </div>

                {/* Business Name (optional) */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Business Name <span className="text-gray-600">(optional)</span></label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    placeholder="Your company name"
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Email <span className="text-gray-600">(optional)</span></label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email address"
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                    />
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Website <span className="text-gray-600">(optional)</span></label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://example.com"
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Description <span className="text-gray-600">(optional)</span></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Tell us about your offer..."
                    rows={3}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FFD166] outline-none resize-none"
                  />
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm hover:scale-[1.02] transition disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Request Partnership"}
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
}