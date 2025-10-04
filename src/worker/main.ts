import { AnagramList } from "./anagram-list";
import { createRequestResonseServer } from "./request-response-server";
import { respondToRequests } from "./worker-responses";

const list = new AnagramList();

respondToRequests(createRequestResonseServer(list))