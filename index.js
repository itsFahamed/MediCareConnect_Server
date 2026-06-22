require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

const uri = process.env.MongoDB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// MIDDLEWARE: Verify Session Token in MongoDB
async function verifySession(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      // Parse better-auth session token from cookies
      const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
        const parts = c.trim().split('=');
        if (parts.length === 2) {
          acc[parts[0]] = parts[1];
        }
        return acc;
      }, {});
      token = cookies['better-auth.session-token'];
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No session token provided" });
    }

    const sessionDb = client.db("medicareconnect").collection("session");
    const userDb = client.db("medicareconnect").collection("user");

    const sessionDoc = await sessionDb.findOne({
      $or: [
        { token: token },
        { sessionToken: token }
      ]
    });
    if (!sessionDoc || new Date(sessionDoc.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }

    let userIdQuery = sessionDoc.userId;
    if (typeof userIdQuery === "string") {
      try {
        userIdQuery = new ObjectId(userIdQuery);
      } catch (e) {
        // Fall back to string if not a valid ObjectId format
      }
    }

    const userDoc = await userDb.findOne({ _id: userIdQuery });
    if (!userDoc) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    if (userDoc.status === "suspended") {
      return res.status(403).json({ error: "Forbidden: Your account has been suspended" });
    }

    req.user = userDoc;
    next();
  } catch (err) {
    res.status(500).json({ error: "Error in authentication middleware: " + err.message });
  }
}

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    
    const db = client.db("medicareconnect");
    
    // Better Auth collections
    const usersCollection = db.collection("user");
    
    // Application collections
    const doctorsCollection = db.collection("doctors");
    const appointmentsCollection = db.collection("appointments");
    const reviewsCollection = db.collection("reviews");
    const paymentsCollection = db.collection("payments");
    const prescriptionsCollection = db.collection("prescriptions");

    // Auto-seed doctors if empty or less than 10
    const docCount = await doctorsCollection.countDocuments();
    if (docCount < 10) {
      await doctorsCollection.deleteMany({});
      await reviewsCollection.deleteMany({}); // Keep reviews in sync
      const sampleDoctors = [
        {
          doctorName: "Dr. Sarah Jenkins",
          specialization: "Cardiology",
          qualifications: "MD, FACC",
          experience: 12,
          consultationFee: 150,
          hospitalName: "City General Hospital",
          profileImage: "https://i.pravatar.cc/150?img=43",
          availableDays: ["Monday", "Wednesday", "Friday"],
          availableSlots: ["09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM"],
          verificationStatus: "verified",
          rating: 4.9
        },
        {
          doctorName: "Dr. Michael Chang",
          specialization: "Neurology",
          qualifications: "MD, PhD",
          experience: 15,
          consultationFee: 200,
          hospitalName: "Neurological Care Center",
          profileImage: "https://i.pravatar.cc/150?img=12",
          availableDays: ["Tuesday", "Thursday"],
          availableSlots: ["02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM"],
          verificationStatus: "verified",
          rating: 4.8
        },
        {
          doctorName: "Dr. Emily Rodriguez",
          specialization: "Pediatrics",
          qualifications: "MD, FAAP",
          experience: 8,
          consultationFee: 100,
          hospitalName: "Metro Children's Clinic",
          profileImage: "https://i.pravatar.cc/150?img=49",
          availableDays: ["Monday", "Tuesday", "Thursday"],
          availableSlots: ["10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM"],
          verificationStatus: "verified",
          rating: 5.0
        },
        {
          doctorName: "Dr. David Kim",
          specialization: "Orthopedics",
          qualifications: "MD, FAAOS",
          experience: 10,
          consultationFee: 180,
          hospitalName: "Orthopedic & Joint Center",
          profileImage: "https://i.pravatar.cc/150?img=33",
          availableDays: ["Wednesday", "Friday"],
          availableSlots: ["03:00 PM - 04:00 PM", "04:00 PM - 05:00 PM"],
          verificationStatus: "verified",
          rating: 4.7
        },
        {
          doctorName: "Dr. Sophia Martinez",
          specialization: "Dermatology",
          qualifications: "MD, FAAD",
          experience: 7,
          consultationFee: 120,
          hospitalName: "Skin & Laser Clinic",
          profileImage: "https://i.pravatar.cc/150?img=28",
          availableDays: ["Tuesday", "Friday"],
          availableSlots: ["09:00 AM - 10:00 AM", "04:00 PM - 05:00 PM"],
          verificationStatus: "verified",
          rating: 4.9
        },
        {
          doctorName: "Dr. James Wilson",
          specialization: "Orthopedics",
          qualifications: "MD, PhD",
          experience: 14,
          consultationFee: 190,
          hospitalName: "City Ortho Care Clinic",
          profileImage: "https://i.pravatar.cc/150?img=68",
          availableDays: ["Monday", "Thursday"],
          availableSlots: ["09:00 AM - 10:00 AM", "03:00 PM - 04:00 PM"],
          verificationStatus: "verified",
          rating: 4.8
        },
        {
          doctorName: "Dr. Lisa Anderson",
          specialization: "Cardiology",
          qualifications: "MD, FACC",
          experience: 9,
          consultationFee: 160,
          hospitalName: "Heart & Vascular Institute",
          profileImage: "https://i.pravatar.cc/150?img=47",
          availableDays: ["Tuesday", "Wednesday", "Friday"],
          availableSlots: ["10:00 AM - 11:00 AM", "02:00 PM - 03:00 PM"],
          verificationStatus: "verified",
          rating: 4.9
        },
        {
          doctorName: "Dr. Robert Taylor",
          specialization: "Pediatrics",
          qualifications: "MD, FAAP",
          experience: 11,
          consultationFee: 110,
          hospitalName: "Valley Kids Hospital",
          profileImage: "https://i.pravatar.cc/150?img=59",
          availableDays: ["Wednesday", "Thursday"],
          availableSlots: ["11:00 AM - 12:00 PM", "04:00 PM - 05:00 PM"],
          verificationStatus: "verified",
          rating: 4.6
        },
        {
          doctorName: "Dr. Patricia Thomas",
          specialization: "Dermatology",
          qualifications: "MD, FAAD",
          experience: 13,
          consultationFee: 130,
          hospitalName: "Dermatological Care Clinic",
          profileImage: "https://i.pravatar.cc/150?img=34",
          availableDays: ["Monday", "Friday"],
          availableSlots: ["09:00 AM - 10:00 AM", "03:00 PM - 04:00 PM"],
          verificationStatus: "verified",
          rating: 4.7
        },
        {
          doctorName: "Dr. William White",
          specialization: "Neurology",
          qualifications: "MD, PhD",
          experience: 16,
          consultationFee: 220,
          hospitalName: "Brain & Nerve Center",
          profileImage: "https://i.pravatar.cc/150?img=11",
          availableDays: ["Monday", "Tuesday"],
          availableSlots: ["10:00 AM - 11:00 AM", "02:00 PM - 03:00 PM"],
          verificationStatus: "verified",
          rating: 4.9
        }
      ];
      await doctorsCollection.insertMany(sampleDoctors);
      console.log("Seeded default doctors.");

      const docs = await doctorsCollection.find().toArray();
      const sampleReviews = [
        {
          patientName: "John Doe",
          doctorId: docs[0]._id.toString(),
          doctorName: docs[0].doctorName,
          rating: 5,
          reviewText: "Dr. Jenkins was extremely professional and explained everything in clear detail. Her diagnosis was spot on.",
          createdAt: new Date()
        },
        {
          patientName: "Alice Smith",
          doctorId: docs[1]._id.toString(),
          doctorName: docs[1].doctorName,
          rating: 5,
          reviewText: "Excellent neurological consultation. Highly knowledgeable and caring specialist.",
          createdAt: new Date()
        },
        {
          patientName: "Robert Johnson",
          doctorId: docs[2]._id.toString(),
          doctorName: docs[2].doctorName,
          rating: 4,
          reviewText: "Great experience at the pediatric clinic. Very friendly staff and child-friendly environment.",
          createdAt: new Date()
        }
      ];
      await reviewsCollection.insertMany(sampleReviews);
      console.log("Seeded default reviews.");
    }

    // Auto-migrate any mismatched or orphaned doctorId in appointments, reviews, payments, prescriptions
    try {
      const allDoctors = await doctorsCollection.find({}).toArray();
      const doctorMap = new Map();
      allDoctors.forEach(doc => {
        doctorMap.set(doc.doctorName, doc._id.toString());
      });

      // Update appointments
      const allAppointments = await appointmentsCollection.find({}).toArray();
      for (const app of allAppointments) {
        const correctId = doctorMap.get(app.doctorName);
        if (correctId && app.doctorId !== correctId) {
          await appointmentsCollection.updateOne(
            { _id: app._id },
            { $set: { doctorId: correctId } }
          );
        }
      }

      // Update reviews
      const allReviews = await reviewsCollection.find({}).toArray();
      for (const rev of allReviews) {
        const correctId = doctorMap.get(rev.doctorName);
        if (correctId && rev.doctorId !== correctId) {
          await reviewsCollection.updateOne(
            { _id: rev._id },
            { $set: { doctorId: correctId } }
          );
        }
      }

      // Update payments
      const allPayments = await paymentsCollection.find({}).toArray();
      for (const pm of allPayments) {
        const correctId = doctorMap.get(pm.doctorName);
        if (correctId && pm.doctorId !== correctId) {
          await paymentsCollection.updateOne(
            { _id: pm._id },
            { $set: { doctorId: correctId } }
          );
        }
      }

      // Update prescriptions
      const allPrescriptions = await prescriptionsCollection.find({}).toArray();
      for (const pr of allPrescriptions) {
        if (pr.appointmentId) {
          let appQueryId = pr.appointmentId;
          if (typeof appQueryId === "string" && appQueryId.length === 24 && /^[0-9a-fA-F]{24}$/.test(appQueryId)) {
            appQueryId = new ObjectId(appQueryId);
          } else if (appQueryId instanceof ObjectId) {
            // Keep as is
          } else {
            // Skip invalid ID formats
            continue;
          }
          
          const app = await appointmentsCollection.findOne({ _id: appQueryId });
          if (app && pr.doctorId !== app.doctorId) {
            await prescriptionsCollection.updateOne(
              { _id: pr._id },
              { $set: { doctorId: app.doctorId } }
            );
          }
        }
      }

      // Re-calculate all doctor average ratings based on reviews
      for (const doc of allDoctors) {
        const reviews = await reviewsCollection.find({ doctorId: doc._id.toString() }).toArray();
        if (reviews.length > 0) {
          const avgRating = reviews.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0) / reviews.length;
          await doctorsCollection.updateOne(
            { _id: doc._id },
            { $set: { rating: parseFloat(avgRating.toFixed(1)) } }
          );
        }
      }
      console.log("Database doctorId and ratings integrity checked and updated.");
    } catch (err) {
      console.error("Failed to run doctorId migration check:", err);
    }

    app.get('/api/status', (req, res) => {
      res.json({ success: true, message: "MediCare Connect API Running" });
    });

    app.get('/api/stats', async (req, res) => {
      try {
        const doctorsCount = await doctorsCollection.countDocuments({ verificationStatus: 'verified' });
        const appointmentsCount = await appointmentsCollection.countDocuments();
        const reviewsCount = await reviewsCollection.countDocuments();
        const uniquePatients = await appointmentsCollection.aggregate([
          { $group: { _id: "$patientId" } }
        ]).toArray();
        
        // Add realistic baseline offsets for a premium, established look
        const displayDoctors = doctorsCount > 0 ? doctorsCount + 140 : 150;
        const displayAppointments = appointmentsCount > 0 ? appointmentsCount + 2450 : 2500;
        const displayReviews = reviewsCount > 0 ? reviewsCount + 780 : 800;
        const displayPatients = Math.max(10000, uniquePatients.length + 9980);

        res.json({
          doctors: displayDoctors,
          patients: displayPatients,
          appointments: displayAppointments,
          reviews: displayReviews
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // DOCTORS API
    app.get('/api/doctors', async (req, res) => {
      try {
        const { search, specialization, sortBy, page = 1, limit = 10, all } = req.query;
        let query = {};
        
        // Hide unverified doctors from public search unless requested (all=true is for admin)
        if (all !== 'true') {
          query.verificationStatus = 'verified';
        }

        if (search) {
          query.doctorName = { $regex: search, $options: 'i' };
        }
        if (specialization) {
          query.specialization = specialization;
        }

        let sortOptions = {};
        if (sortBy === 'fee_asc') sortOptions.consultationFee = 1;
        if (sortBy === 'fee_desc') sortOptions.consultationFee = -1;
        if (sortBy === 'experience') sortOptions.experience = -1;
        if (sortBy === 'rating') sortOptions.rating = -1;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const doctors = await doctorsCollection.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit)).toArray();
        const total = await doctorsCollection.countDocuments(query);
        
        res.json({ doctors, total, page: parseInt(page), limit: parseInt(limit) });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/doctors/:id', async (req, res) => {
      try {
        const doctor = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.json(doctor);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Create or update doctor profile (doctor onboarding/updates)
    app.post('/api/doctors', verifySession, async (req, res) => {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ error: "Only doctors can configure their profile" });
      }
      try {
        const profile = req.body;
        const userId = req.user._id;

        const existing = await doctorsCollection.findOne({ userId });
        let result;
        if (existing) {
          const updateData = { ...profile };
          delete updateData._id;
          delete updateData.userId;

          result = await doctorsCollection.updateOne(
            { userId },
            { $set: { 
              ...updateData, 
              doctorName: req.user.name, 
              profileImage: updateData.profileImage || req.user.image 
            }}
          );
        } else {
          result = await doctorsCollection.insertOne({
            ...profile,
            userId,
            doctorName: req.user.name,
            profileImage: profile.profileImage || req.user.image,
            verificationStatus: 'pending' // pending initially
          });
        }
        res.json({ acknowledged: true, result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // APPOINTMENTS API
    app.post('/api/appointments', async (req, res) => {
      try {
        const appointment = { ...req.body, appointmentStatus: 'Pending', createdAt: new Date() };
        const result = await appointmentsCollection.insertOne(appointment);
        
        if (req.body.paymentStatus === 'Paid') {
          await paymentsCollection.insertOne({
            appointmentId: result.insertedId.toString(),
            patientId: req.body.patientId,
            patientName: req.body.patientName,
            doctorId: req.body.doctorId,
            doctorName: req.body.doctorName,
            amount: req.body.amount,
            transactionId: req.body.transactionId,
            paymentDate: new Date(),
            status: 'Paid'
          });
        }

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/my-appointments', async (req, res) => {
      try {
        const { patientId, doctorId } = req.query;
        let query = {};
        if (patientId) query.patientId = patientId;
        if (doctorId) query.doctorId = doctorId;
        const appointments = await appointmentsCollection.find(query).toArray();
        res.json(appointments);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch('/api/appointments/:id', async (req, res) => {
      try {
        const appointmentId = req.params.id;
        const updateData = { ...req.body };
        
        // Find existing appointment first
        const appointment = await appointmentsCollection.findOne({ _id: new ObjectId(appointmentId) });
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        // Check if status is transitioning to Cancelled
        if (updateData.appointmentStatus === 'Cancelled' && appointment.appointmentStatus !== 'Cancelled') {
          if (appointment.paymentStatus === 'Paid') {
            updateData.paymentStatus = 'Refunded';

            // Process Stripe refund if there is a real transaction ID
            const transactionId = appointment.transactionId;
            if (transactionId && !transactionId.startsWith('ch_mock_') && !transactionId.startsWith('pi_mock_') && !transactionId.includes('mock')) {
              try {
                await stripe.refunds.create({
                  payment_intent: transactionId
                });
                console.log(`Successfully processed Stripe refund for appointment ${appointmentId}`);
              } catch (stripeErr) {
                console.error(`Stripe refund failed for transaction ${transactionId}:`, stripeErr.message);
                // Try fallback to charge parameter
                try {
                  await stripe.refunds.create({
                    charge: transactionId
                  });
                  console.log(`Successfully processed Stripe fallback refund for appointment ${appointmentId}`);
                } catch (fallbackErr) {
                  console.error(`Stripe fallback refund failed:`, fallbackErr.message);
                }
              }
            }

            // Update payment transaction document status to 'Refunded'
            try {
              await paymentsCollection.updateOne(
                { appointmentId: appointmentId },
                { $set: { status: 'Refunded', refundedAt: new Date() } }
              );
            } catch (dbErr) {
              console.error(`Failed to update payments collection for appointment ${appointmentId}:`, dbErr);
            }
          }
        }

        const result = await appointmentsCollection.updateOne(
          { _id: new ObjectId(appointmentId) },
          { $set: updateData }
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete('/api/appointments/:id', async (req, res) => {
      try {
        const result = await appointmentsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // STRIPE PAYMENT INTENT (Fallback/legacy)
    app.post('/api/create-payment-intent', async (req, res) => {
      try {
        const { amount } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(parseFloat(amount) * 100), // Stripe expects cents
          currency: 'usd',
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // STRIPE CHECKOUT SESSIONS
    app.post('/api/create-checkout-session', async (req, res) => {
      try {
        const {
          patientId,
          patientName,
          patientEmail,
          doctorId,
          doctorName,
          appointmentDate,
          appointmentTime,
          symptoms,
          amount
        } = req.body;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Consultation with Dr. ${doctorName}`,
                description: `Appointment on ${appointmentDate} at ${appointmentTime}`,
              },
              unit_amount: Math.round(parseFloat(amount) * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `http://localhost:3000/dashboard/patient/appointments?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `http://localhost:3000/doctors/${doctorId}`,
          metadata: {
            patientId,
            patientName,
            patientEmail,
            doctorId,
            doctorName,
            appointmentDate,
            appointmentTime,
            symptoms,
            amount: amount.toString(),
          }
        });

        res.json({ id: session.id, url: session.url });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/verify-checkout-session', async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: "Session ID is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
          return res.json({ success: false, message: "Payment not completed" });
        }

        // Check if this checkout session has already been registered
        const existing = await appointmentsCollection.findOne({ checkoutSessionId: sessionId });
        if (existing) {
          return res.json({ success: true, alreadyRegistered: true, result: existing });
        }

        const appointment = {
          patientId: session.metadata.patientId,
          patientName: session.metadata.patientName,
          patientEmail: session.metadata.patientEmail,
          doctorId: session.metadata.doctorId,
          doctorName: session.metadata.doctorName,
          appointmentDate: session.metadata.appointmentDate,
          appointmentTime: session.metadata.appointmentTime,
          symptoms: session.metadata.symptoms,
          amount: parseFloat(session.metadata.amount),
          paymentStatus: 'Paid',
          transactionId: session.payment_intent || session.id,
          checkoutSessionId: sessionId,
          appointmentStatus: 'Pending',
          createdAt: new Date()
        };

        const result = await appointmentsCollection.insertOne(appointment);

        // Record the payment log
        await paymentsCollection.insertOne({
          appointmentId: result.insertedId.toString(),
          patientId: session.metadata.patientId,
          patientName: session.metadata.patientName,
          doctorId: session.metadata.doctorId,
          doctorName: session.metadata.doctorName,
          amount: parseFloat(session.metadata.amount),
          transactionId: session.payment_intent || session.id,
          paymentDate: new Date(),
          status: 'Paid'
        });

        res.json({ success: true, result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // REVIEWS API
    app.post('/api/reviews', async (req, res) => {
      try {
        const result = await reviewsCollection.insertOne({ ...req.body, createdAt: new Date() });
        
        // Dynamically compute average rating for the doctor and update the doctor document
        const reviews = await reviewsCollection.find({ doctorId: req.body.doctorId }).toArray();
        const avgRating = reviews.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0) / reviews.length;
        await doctorsCollection.updateOne(
          { _id: new ObjectId(req.body.doctorId) },
          { $set: { rating: parseFloat(avgRating.toFixed(1)) } }
        );

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/reviews', async (req, res) => {
      try {
        const { doctorId, patientId, limit } = req.query;
        let query = {};
        if (doctorId) query.doctorId = doctorId;
        if (patientId) query.patientId = patientId;

        let cursor = reviewsCollection.find(query);
        if (limit) {
          cursor = cursor.limit(parseInt(limit));
        }
        const reviews = await cursor.toArray();
        res.json(reviews);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch('/api/reviews/:id', async (req, res) => {
      try {
        const result = await reviewsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: req.body }
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete('/api/reviews/:id', async (req, res) => {
      try {
        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // PRESCRIPTIONS API
    app.post('/api/prescriptions', async (req, res) => {
      try {
        const result = await prescriptionsCollection.insertOne({ ...req.body, createdAt: new Date() });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/prescriptions', async (req, res) => {
      try {
        const prescriptions = await prescriptionsCollection.find(req.query).toArray();
        res.json(prescriptions);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch('/api/prescriptions/:id', async (req, res) => {
      try {
        const result = await prescriptionsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: req.body }
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete('/api/prescriptions/:id', async (req, res) => {
      try {
        const result = await prescriptionsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ADMIN APIS
    app.get('/api/admin/users', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const users = await usersCollection.find().toArray();
        res.json(users);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch('/api/admin/users/:id', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const { status } = req.body;
        const result = await usersCollection.updateOne(
          { _id: req.params.id },
          { $set: { status } }
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete('/api/admin/users/:id', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const result = await usersCollection.deleteOne({ _id: req.params.id });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch('/api/admin/doctors/:id/verify', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const { verificationStatus } = req.body;
        const doctorIdStr = req.params.id;

        // Fetch existing doctor profile first to check if they are currently verified
        const doctorProfile = await doctorsCollection.findOne({ _id: new ObjectId(doctorIdStr) });
        
        const result = await doctorsCollection.updateOne(
          { _id: new ObjectId(doctorIdStr) },
          { $set: { verificationStatus } }
        );

        // If the status is being revoked or rejected, cancel & refund all their active appointments
        if (verificationStatus !== 'verified') {
          const activeAppointments = await appointmentsCollection.find({
            doctorId: doctorIdStr,
            appointmentStatus: { $nin: ['Completed', 'Cancelled', 'Rejected'] }
          }).toArray();

          for (const app of activeAppointments) {
            const updatePayload = { appointmentStatus: 'Cancelled' };
            if (app.paymentStatus === 'Paid') {
              updatePayload.paymentStatus = 'Refunded';

              // Stripe refund logic
              const transactionId = app.transactionId;
              if (transactionId && !transactionId.startsWith('ch_mock_') && !transactionId.startsWith('pi_mock_') && !transactionId.includes('mock')) {
                try {
                  await stripe.refunds.create({
                    payment_intent: transactionId
                  });
                  console.log(`Successfully processed Stripe refund for appointment ${app._id} (doctor revoked)`);
                } catch (stripeErr) {
                  console.error(`Stripe refund failed for transaction ${transactionId}:`, stripeErr.message);
                  try {
                    await stripe.refunds.create({
                      charge: transactionId
                    });
                    console.log(`Successfully processed Stripe fallback refund for appointment ${app._id} (doctor revoked)`);
                  } catch (fallbackErr) {
                    console.error(`Stripe fallback refund failed:`, fallbackErr.message);
                  }
                }
              }

              // Update payments collection status to 'Refunded'
              try {
                await paymentsCollection.updateOne(
                  { appointmentId: app._id.toString() },
                  { $set: { status: 'Refunded', refundedAt: new Date() } }
                );
              } catch (dbErr) {
                console.error(`Failed to update payments collection for appointment ${app._id}:`, dbErr);
              }
            }

            // Perform the cancellation update on the appointment
            await appointmentsCollection.updateOne(
              { _id: app._id },
              { $set: updatePayload }
            );
          }
          console.log(`Cancelled and refunded ${activeAppointments.length} appointments for revoked doctor ${doctorIdStr}`);
        }

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/admin/appointments', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const appointments = await appointmentsCollection.find().toArray();
        res.json(appointments);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/admin/payments', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const payments = await paymentsCollection.find().toArray();
        res.json(payments);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/admin/analytics', verifySession, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied: Admins only" });
      try {
        const totalDoctors = await doctorsCollection.countDocuments({ verificationStatus: 'verified' });
        const totalPatients = await usersCollection.countDocuments({ role: 'patient' });
        const totalAppointments = await appointmentsCollection.countDocuments();
        
        const payments = await paymentsCollection.find().toArray();
        const totalEarnings = payments.reduce((sum, p) => sum + (p.status === 'Refunded' ? 0 : parseFloat(p.amount || 0)), 0);

        // Aggregate doctor ratings for Recharts
        const docs = await doctorsCollection.find({ verificationStatus: 'verified' }).toArray();
        const performanceData = docs.map(d => ({
          name: d.doctorName,
          rating: d.rating || 0
        })).filter(d => d.rating > 0);

        // 1. Timeline Data (Last 7 Days)
        const timelineData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          timelineData.push({ date: dateStr, count: 0 });
        }
        
        const allApps = await appointmentsCollection.find({}).toArray();
        allApps.forEach(app => {
          if (app.createdAt) {
            const appDateStr = new Date(app.createdAt).toISOString().slice(0, 10);
            const entry = timelineData.find(t => t.date === appDateStr);
            if (entry) {
              entry.count += 1;
            }
          }
        });

        // Ensure we always have some mock data if fresh/empty database for a beautiful bell curve
        const totalRecent = timelineData.reduce((sum, t) => sum + t.count, 0);
        if (totalRecent < 5) {
          const mockTimeline = [1, 1, 2, 1, 3, 2, totalRecent || 1];
          timelineData.forEach((t, index) => {
            t.count = mockTimeline[index];
          });
        }

        // 2. Specialty Breakdown
        const specializationCounts = {};
        const allDoctorsList = await doctorsCollection.find({ verificationStatus: 'verified' }).toArray();
        allDoctorsList.forEach(doc => {
          const spec = doc.specialization || "General Medicine";
          specializationCounts[spec] = (specializationCounts[spec] || 0) + 1;
        });
        const specialtyData = Object.entries(specializationCounts).map(([name, value]) => ({
          name,
          value
        }));

        if (specialtyData.length === 0) {
          specialtyData.push(
            { name: "Cardiology", value: 3 },
            { name: "Neurology", value: 2 },
            { name: "Orthopedics", value: 2 },
            { name: "Pediatrics", value: 3 },
            { name: "General Medicine", value: 4 }
          );
        }

        // 3. Venn Diagram active patient connections
        const allAppointmentsForDistinct = await appointmentsCollection.find({}, { projection: { patientId: 1 } }).toArray();
        const uniquePatientsWithBookings = [...new Set(allAppointmentsForDistinct.map(app => app.patientId))];
        const activePatientCount = uniquePatientsWithBookings.length;

        res.json({
          totalDoctors,
          totalPatients,
          totalAppointments,
          totalEarnings,
          performanceData,
          timelineData,
          specialtyData,
          activePatientCount
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

  } finally {
    // Keep connection open
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`MediCare Connect Server is running on port ${port}`);
});
