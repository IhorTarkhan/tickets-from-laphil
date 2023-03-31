import express, {Request, RequestHandler, Response} from "express";
import GlobalDependencies from "./dependency/GlobalDependencies";
import LocalDependencies from "./dependency/LocalDependencies";
import TicketDto from "./dto/laphil.response/TicketDto";
import PriceDto from "./dto/laphil.response/PriceDto";
import SectionDto from "./dto/laphil.response/SectionDto";
import AvailableTicketDto from "./dto/response/AvailableTicketDto";
import {pipe} from "fp-ts/function"
import * as O from "fp-ts/Option";
import * as A from "fp-ts/Array"
import {Reader} from "fp-ts/Reader"
import {Predicate} from "fp-ts/Predicate";

const app = express();
const port = 3000;


const sectionsPromise = fetch("https://my.laphil.com/en/rest-proxy/ReferenceData/Sections")
    .then(res => res.json())
    .then((sections: SectionDto[]) => {
        return new Map(sections.map(it => [it.Id, it.Description]));
    });

const handleAvailableTicketsById: Reader<GlobalDependencies, RequestHandler> = (deps: GlobalDependencies) =>
    (request: Request, response: Response) => {
        const id: string = request.params.performanceId;
        /**
         * Here getting only `Active` statuses, according this status list: https://my.laphil.com/en/rest-proxy/ReferenceData/SeatStatuses
         */
        const onlyActive: Predicate<TicketDto> = (ticket: TicketDto): boolean => ticket.SeatStatusId === 0
        const toAvailableResponse = (localDeps: LocalDependencies) =>
            (ticket: TicketDto): AvailableTicketDto => (
                {
                    section: pipe(O.fromNullable(deps.sections.get(ticket.SectionId)), O.getOrElse(() => "-")),
                    row: ticket.SeatRow,
                    seatNumber: ticket.SeatNumber,
                    price: pipe(O.fromNullable(localDeps.priceByZone.get(ticket.ZoneId)), O.getOrElse(() => -1))
                }
            )

        const ticketsPromise =
            fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/${id}/Seats?constituentId=0&modeOfSaleId=4&performanceId=${id}`)
                .then(res => res.json());
        const pricesPromise =
            fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/Prices?modeOfSaleId=4&performanceIds=${id}`)
                .then(res => res.json());

        Promise.all([ticketsPromise, pricesPromise])
            .then(([tickets, prices]: [TicketDto[], PriceDto[]]) => {
                    const priceByZone = new Map(prices.map(p => [p.ZoneId, p.Price]));
                    const localDeps: LocalDependencies = {priceByZone};
                    return response.status(200).json(
                        pipe(
                            tickets,
                            A.filter(onlyActive),
                            A.map(toAvailableResponse(localDeps)),
                        ));
                }
            )
    }

Promise.all([sectionsPromise]).then(([sections]) => {
    const deps: GlobalDependencies = {sections}

    app.get("/laphil/available-tickets/:performanceId", handleAvailableTicketsById(deps));

    app.listen(port, () => console.log(`Application is running on port ${port}.`))
})

