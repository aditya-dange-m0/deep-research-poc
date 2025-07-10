// pages/api/tools/search.ts
import { NextRequest, NextResponse } from 'next/server';
import { getComposioAppToolsFromPinecone, initializePineconeIndex } from '@/lib/pineconeInit'; // Our semantic search function
import { ToolsObject } from '@/types/types';

interface SearchRequestBody {
  appName: string;
  userQuery: string;
  topK?: number; // It's better to expect number here if you're sending it parsed
}

type SearchResponseData = {
  relevantTools: string[]; // We only want to return tool names
  message?: string;
  error?: string;
};

export async function POST(req: Request) { // req is a standard Web Request object for POST
  try {
    // Initialize Pinecone client and index.
    // This function is idempotent and safe to call on every request.
    await initializePineconeIndex();

    // Parse the JSON body of the request for App Router POST requests
    const { appName, userQuery, topK } = (await req.json()) as SearchRequestBody;

    // Basic validation for required parameters
    if (!appName || !userQuery) {
      return NextResponse.json(
        { relevantTools: [], message: 'Missing appName or userQuery in request body.' },
        { status: 400 }
      );
    }

    // Parse topK, default to 3 if not provided or invalid
    // const k = topK ? (typeof topK === 'string' ? parseInt(topK, 10) : topK) : 3;
    // if (isNaN(k) || k <= 0) {
    //   return NextResponse.json(
    //     { relevantTools: [], message: 'Invalid topK parameter. Must be a positive integer.' },
    //     { status: 400 }
    //   );
    // }

    // Our semantic search function which retrieves the full tool objects
    const relevantToolsObject: string[] = await getComposioAppToolsFromPinecone(appName, userQuery, topK);

    // Extract only the tool names (keys of the returned object)
    // const relevantToolNames = Object.keys(relevantToolsObject);

    // Return a JSON response using NextResponse.json()
    return NextResponse.json(
      {
        relevantTools: relevantToolsObject,
        message: `Found ${relevantToolsObject.length} relevant tools for app: ${appName}`
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`API Error during tool search:`, error);
    // Return an error response using NextResponse.json()
    return NextResponse.json(
      { relevantTools: [], message: 'Failed to search for tools', error: error.message },
      { status: 500 }
    );
  }
}







// export async function GET(req: NextRequest) {
//   try {
//     // Initialize Pinecone client and index.
//     // This function is idempotent and safe to call on every request.
//     await initializePineconeIndex();


//     // Access query parameters using req.nextUrl.searchParams for App Router GET requests
//     const { searchParams } = req.nextUrl;
//     const appName = searchParams.get('appName');
//     const userQuery = searchParams.get('userQuery');
//     const topKParam = searchParams.get('topK');

//     // Basic validation for required parameters
//     if (!appName || !userQuery) {
//       return NextResponse.json(
//         { relevantTools: [], message: 'Missing appName or userQuery in query parameters.' },
//         { status: 400 }
//       );
//     }

//     // Parse topK, default to 3 if not provided or invalid
//     const k = topKParam ? parseInt(topKParam, 10) : 3;
//     if (isNaN(k) || k <= 0) {
//       return NextResponse.json(
//         { relevantTools: [], message: 'Invalid topK parameter. Must be a positive integer.' },
//         { status: 400 }
//       );
//     }

//     // Our semantic search function which retrieves the full tool objects
//     const relevantToolsObject: ToolsObject = await getComposioAppToolsFromPinecone(appName, userQuery, k);

//     // Extract only the tool names (keys of the returned object)
//     const relevantToolNames = Object.keys(relevantToolsObject);

//     // Return a JSON response using NextResponse.json()
//     return NextResponse.json(
//       {
//         relevantTools: relevantToolNames,
//         message: `Found ${relevantToolNames.length} relevant tools for app: ${appName}`
//       },
//       { status: 200 }
//     );
//   } catch (error: any) {
//     console.error(`API Error during tool search for ${appName} with query "${userQuery}":`, error);
//     // Return an error response using NextResponse.json()
//     return NextResponse.json(
//       { relevantTools: [], message: 'Failed to search for tools', error: error.message },
//       { status: 500 }
//     );
//   }
// }