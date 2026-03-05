
const express=require('express');
const cors=require('cors');
const reviewRoutes=require('./routes/reviewRoutes');
const app=express();

app.use(cors())
app.use(express.json())


app.use("/api/reviews", reviewRoutes)

app.listen(3000,()=>[
    console.log("Server is running on port 3000")
    
])







