import express, {Request, RequestHandler, Response} from "express";

const app = express();
const port = 3000;


const getLocationsWithTimezones: RequestHandler = (request: Request, response: Response) => {
    const result = {
        data: "some text",
        number: 200
    }

    response.status(200).json(result);
};

app.get("/test", getLocationsWithTimezones);

app.listen(port, () => {
    console.log(`Application is running on port ${port}.`);
});
