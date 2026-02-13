import { redirect } from "next/navigation"
import clientPromise from "@/lib/mongodb"

export async function GET(request, { params }) {
    const { shorturl } = await params

    const client = await clientPromise;
    const db = client.db("bitlinks")
    const collection = db.collection("url")

    const doc = await collection.findOne({ shorturl: shorturl })
    console.log("Found document:", doc)

    if (doc) {
        // Redirect to the actual URL
        redirect(doc.url)
    } else {
        // If not found, redirect to home
        redirect(process.env.NEXT_PUBLIC_HOST || '/')
    }
}